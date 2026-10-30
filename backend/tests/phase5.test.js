import { beforeAll, afterAll, beforeEach, it, expect, describe } from 'vitest';
import { setupWorkflow, fixtures, client, config, point, requestInput, createRequest } from './helpers/workflow.js';
import { User } from '../src/models/User.js';
import { Facility } from '../src/models/Facility.js';
import { BloodRequest } from '../src/models/BloodRequest.js';
import { matchBloodRequest } from '../src/services/requestMatchingService.js';
import { expireRequests } from '../src/services/requestService.js';
import { assertRequestActive } from '../src/utils/requestState.js';
let env, f;
beforeAll(async () => { env = await setupWorkflow(); });
beforeEach(async () => { f = await fixtures(); });
afterAll(async () => { await env?.close(); });
const call = (method, path, body, actor) => client(env.app, actor === undefined ? f.staff : actor, method, path, body);
describe('legitimate request creation and location', () => {
  it('creates an OPEN request with zero units received and a facility snapshot', async () => {
    const r = await createRequest(env.app, f.staff);
    expect(r).toMatchObject({ requestingFacility: f.facility.id, createdBy: f.staff.id, status: 'OPEN', unitsReceived: 0, unitsNeeded: 2, remainingUnits: 2, requestLocation: point });
    expect(r.patientName).toBeUndefined(); expect(r.mutationVersion).toBeUndefined();
  });
  it.each(['donor', 'admin', 'anonymous'])('rejects request creation by %s', async role => {
    const actor = role === 'anonymous' ? null : f[role];
    expect((await call('post', '/requests', requestInput(), actor)).status).toBe(role === 'anonymous' ? 401 : 403);
  });
  it('requires an explicit creation permission', async () => {
    await User.updateOne({ _id: f.staff._id }, { facilityPermissions: ['VERIFY_DONORS'] });
    expect((await call('post', '/requests', requestInput())).status).toBe(403);
  });
  it.each(['PENDING', 'REJECTED', 'SUSPENDED'])('rejects %s facilities', async status => {
    await Facility.updateOne({ _id: f.facility._id }, { verificationStatus: status });
    expect((await call('post', '/requests', requestInput())).status).toBe(403);
  });
  it('rejects inactive facilities and staff', async () => {
    await Facility.updateOne({ _id: f.facility._id }, { isActive: false });
    expect((await call('post', '/requests', requestInput())).status).toBe(403);
    await User.updateOne({ _id: f.staff._id }, { isActive: false });
    expect((await call('post', '/requests', requestInput())).status).toBe(401);
  });
  it('requires administrator-provided facility location', async () => {
    await Facility.updateOne({ _id: f.facility._id }, { $unset: { location: '' } });
    expect((await call('post', '/requests', requestInput())).body.error.code).toBe('FACILITY_LOCATION_REQUIRED');
  });
  it('only admin can set facility coordinates and existing request snapshots stay unchanged', async () => {
    const r = await createRequest(env.app, f.staff);
    const newPoint = { type: 'Point', coordinates: [-16.5, 13.5] };
    expect((await call('put', `/admin/facilities/${f.facility.id}/location`, newPoint)).status).toBe(403);
    expect((await call('put', `/admin/facilities/${f.facility.id}/location`, newPoint, f.admin)).status).toBe(200);
    expect((await call('get', `/requests/${r.id}`)).body.data.requestLocation).toEqual(point);
    expect((await createRequest(env.app, f.staff)).requestLocation).toEqual(newPoint);
  });
  it.each([
    { patientBloodType: 'bad' }, { unitsNeeded: 0 }, { unitsNeeded: 101 }, { unitsNeeded: 1.5 }, { unitsNeeded: '2' },
    { urgency: 'NOW' }, { expiresAt: 'bad' }, { expiresAt: new Date(0).toISOString() },
    { expiresAt: new Date(Date.now() + 1000 * 3600000).toISOString() },
    { requestLocation: point }, { requestingFacility: 'forged' }, { unitsReceived: 1 }, { status: 'FULFILLED' }, { patientName: 'not permitted' },
  ])('rejects invalid or mass-assigned input %#', async patch => { expect((await call('post', '/requests', requestInput(patch))).status).toBe(400); });
});
describe('ownership, lifecycle and internal matching', () => {
  it('lists only own facility requests while admin can inspect all', async () => {
    const own = await createRequest(env.app, f.staff); await createRequest(env.app, f.otherStaff);
    expect((await call('get', '/requests')).body.data.requests.map(r => r.id)).toEqual([own.id]);
    expect((await call('get', '/requests', undefined, f.admin)).body.data.pagination.total).toBe(2);
    expect((await call('get', `/requests/${own.id}`, undefined, f.otherStaff)).status).toBe(404);
    expect((await call('get', `/requests/${own.id}`, undefined, f.donor)).status).toBe(403);
  });
  it('cancels an own active request, never a foreign one', async () => {
    const r = await createRequest(env.app, f.staff);
    expect((await call('patch', `/requests/${r.id}/cancel`, { reason: 'No longer required' }, f.otherStaff)).status).toBe(404);
    const res = await call('patch', `/requests/${r.id}/cancel`, { reason: 'No longer required' });
    expect(res.body.data.status).toBe('CANCELLED'); expect(res.body.data.cancelledAt).toBeTruthy();
    expect((await call('patch', `/requests/${r.id}/cancel`, { reason: 'Again' })).status).toBe(409);
  });
  it('requires management permission for cancellation', async () => {
    const r = await createRequest(env.app, f.staff);
    await User.updateOne({ _id: f.staff._id }, { facilityPermissions: ['CREATE_BLOOD_REQUESTS'] });
    expect((await call('patch', `/requests/${r.id}/cancel`, { reason: 'No longer required' })).status).toBe(403);
  });
  it('fails closed on expiry without requiring cleanup and can persist expiration afterward', async () => {
    const r = await createRequest(env.app, f.staff);
    await BloodRequest.collection.updateOne({ _id: (await BloodRequest.findById(r.id))._id }, { $set: { expiresAt: new Date(0) } });
    expect((await call('get', `/requests/${r.id}`)).body.data.status).toBe('EXPIRED');
    expect((await call('get', '/requests?status=OPEN')).body.data.pagination.total).toBe(0);
    expect((await call('get', '/requests?status=EXPIRED')).body.data.pagination.total).toBe(1);
    expect((await call('patch', `/requests/${r.id}/cancel`, { reason: 'Too late' })).status).toBe(409);
    await expect(matchBloodRequest(f.staff._id, r.id, config)).rejects.toMatchObject({ code: 'REQUEST_INACTIVE' });
    await expireRequests(); expect((await BloodRequest.findById(r.id)).status).toBe('EXPIRED');
  });
  it.each(['FULFILLED', 'EXPIRED', 'CANCELLED'])('does not cancel a terminal %s request', async status => {
    const r = await createRequest(env.app, f.staff); await BloodRequest.updateOne({ _id: r.id }, { status });
    expect((await call('patch', `/requests/${r.id}/cancel`, { reason: 'Too late' })).status).toBe(409);
  });
  it('matches only from stored request blood type/location through an authorized internal caller', async () => {
    const r = await createRequest(env.app, f.staff);
    const result = await matchBloodRequest(f.staff._id, r.id, config);
    expect(result.candidates.map(c => c.donorId)).toEqual([f.donor.id]);
    expect(Object.keys(result.candidates[0]).sort()).toEqual(['distanceMeters', 'donorId', 'verifiedBloodType']);
    await expect(matchBloodRequest(f.otherStaff._id, r.id, config)).rejects.toMatchObject({ code: 'REQUEST_NOT_FOUND' });
    expect((await call('get', `/requests/${r.id}/matches`)).status).toBe(404);
  });
  it('validates identifiers, reasons and query limits', async () => {
    expect((await call('get', '/requests/bad')).status).toBe(400);
    expect((await call('get', '/requests?limit=101')).status).toBe(400);
    expect((await call('get', '/requests?status[$ne]=OPEN')).status).toBe(400);
    const r = await createRequest(env.app, f.staff);
    expect((await call('patch', `/requests/${r.id}/cancel`, { reason: '' })).status).toBe(400);
    expect(() => assertRequestActive({ status: 'OPEN', expiresAt: new Date('bad') })).toThrow();
  });
});
