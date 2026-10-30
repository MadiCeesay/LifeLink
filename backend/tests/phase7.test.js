import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { setupWorkflow, fixtures, client, createRequest, config, point } from './helpers/workflow.js';
import { User } from '../src/models/User.js';
import { BloodRequest } from '../src/models/BloodRequest.js';
import { Notification } from '../src/models/Notification.js';
import { Donation } from '../src/models/Donation.js';
import { DonorResponse } from '../src/models/DonorResponse.js';
import { createMatchingService } from '../src/services/matchingService.js';
import { isDonationPaused } from '../src/utils/donationState.js';
import { parseEnv } from '../src/config/env.js';
let env, f, r;
beforeAll(async () => { env = await setupWorkflow(); });
beforeEach(async () => { f = await fixtures(); r = await createRequest(env.app, f.staff); });
afterEach(() => vi.restoreAllMocks()); afterAll(async () => { await env?.close(); });
const call = (actor, method, path, body) => client(env.app, actor, method, path, body);
const confirm = (donorId, units = 1, actor) => call(actor ?? f.staff, 'post', `/requests/${r.id}/donations`, { donorId: donorId ?? f.donor.id, units });
async function accept(donor = f.donor) {
  const broadcast = await call(f.staff, 'post', `/requests/${r.id}/broadcast`, { idempotencyKey: randomUUID() }); expect(broadcast.status).toBe(200);
  const n = await Notification.findOne({ bloodRequest: r.id, recipient: donor._id });
  const response = await call(donor, 'post', `/notifications/${n.id}/response`, { status: 'ACCEPTED' }); expect(response.status).toBe(200);
}
describe('facility-confirmed donations and fulfilment', () => {
  it('acceptance alone is not a donation', async () => { await accept(); expect(await Donation.countDocuments()).toBe(0); expect((await BloodRequest.findById(r.id)).unitsReceived).toBe(0); });
  it.each(['donor', 'admin', 'otherStaff'])('rejects confirmation by %s', async role => {
    await accept(); expect((await confirm(undefined, 1, f[role])).status).toBe(role === 'otherStaff' ? 404 : 403);
  });
  it('requires the explicit confirmation permission and an accepted response', async () => {
    expect((await confirm()).body.error.code).toBe('ACCEPTED_RESPONSE_REQUIRED'); await accept();
    await User.updateOne({ _id: f.staff._id }, { facilityPermissions: ['MANAGE_BLOOD_REQUESTS'] }); expect((await confirm()).status).toBe(403);
  });
  it('confirms partial then full fulfilment transactionally without changing availability', async () => {
    await accept(); const first = await confirm(); expect(first.status).toBe(200); expect(first.body.data.units).toBe(1);
    let request = await BloodRequest.findById(r.id); expect(request.status).toBe('PARTIALLY_FILLED'); expect(request.unitsReceived).toBe(1);
    const donor = await User.findById(f.donor.id).select('+lastConfirmedDonationAt'); expect(donor.lastConfirmedDonationAt).toBeInstanceOf(Date); expect(donor.availabilityStatus).toBe('AVAILABLE');
    const second = await User.create({ ...f.donor.toObject(), _id: undefined, email: 'second-donation@example.com' }); await accept(second);
    expect((await confirm(second.id)).status).toBe(200); request = await BloodRequest.findById(r.id);
    expect(request.status).toBe('FULFILLED'); expect(request.unitsReceived).toBe(2); expect(request.fulfilledAt).toBeInstanceOf(Date); expect(await Donation.countDocuments()).toBe(2);
  });
  it('supports bounded multi-unit confirmations when the remaining requirement permits', async () => {
    await accept(); expect((await confirm(undefined, 2)).status).toBe(200); expect((await BloodRequest.findById(r.id)).status).toBe('FULFILLED');
  });
  it('makes an identical retry idempotent even after fulfilment', async () => {
    await accept(); const first = await confirm(undefined, 2); const second = await confirm(undefined, 2);
    expect(first.body.data.id).toBe(second.body.data.id); expect(await Donation.countDocuments()).toBe(1); expect((await BloodRequest.findById(r.id)).unitsReceived).toBe(2);
    expect((await confirm(undefined, 1)).status).toBe(409);
  });
  it('rejects overfill and malformed confirmation payloads', async () => {
    await accept(); expect((await confirm(undefined, 3)).body.error.code).toBe('UNITS_EXCEED_REMAINING');
    for (const units of [0, -1, 1.5, 5, '1']) expect((await confirm(undefined, units)).status).toBe(400);
    expect((await call(f.staff, 'post', `/requests/${r.id}/donations`, { donorId: f.donor.id, units: 1, confirmedAt: new Date().toISOString() })).status).toBe(400);
  });
  it('rolls back donation, request units and last donation if request persistence fails', async () => {
    await accept(); vi.spyOn(BloodRequest.prototype, 'save').mockRejectedValueOnce(new Error('simulated request persistence failure'));
    expect((await confirm()).status).toBe(500); expect(await Donation.countDocuments()).toBe(0); expect((await BloodRequest.findById(r.id)).unitsReceived).toBe(0);
    expect((await User.findById(f.donor.id).select('+lastConfirmedDonationAt')).lastConfirmedDonationAt).toBeNull();
  });
  it('serializes concurrent duplicate confirmations', async () => {
    await accept(); const res = await Promise.all([confirm(), confirm()]); expect(res.map(x => x.status)).toEqual([200, 200]); expect(await Donation.countDocuments()).toBe(1); expect((await BloodRequest.findById(r.id)).unitsReceived).toBe(1);
  });
  it('prevents concurrent different donors from overfilling the remaining unit', async () => {
    r = await createRequest(env.app, f.staff, { unitsNeeded: 1 }); const second = await User.create({ ...f.donor.toObject(), _id: undefined, email: 'racing@example.com' });
    await accept(); await accept(second);
    const results = await Promise.all([confirm(), confirm(second.id)]); expect(results.map(x => x.status).sort()).toEqual([200, 409]);
    expect(await Donation.countDocuments()).toBe(1); expect((await BloodRequest.findById(r.id)).unitsReceived).toBe(1);
  });
  it('closed requests reject new broadcasts/responses and stop exposing contact', async () => {
    await accept(); await confirm(undefined, 2);
    expect((await call(f.staff, 'post', `/requests/${r.id}/broadcast`, { idempotencyKey: randomUUID() })).status).toBe(409);
    const n = await Notification.findOne(); expect((await call(f.donor, 'post', `/notifications/${n.id}/response`, { status: 'ACCEPTED' })).status).toBe(409);
    expect((await call(f.staff, 'get', `/requests/${r.id}/responses`)).body.data.responses[0].donor).toBeNull();
  });
  it('history is confirmed-record based, scoped, shaped and append-only', async () => {
    await accept(); await confirm();
    const own = await call(f.donor, 'get', '/donors/me/donations'); expect(own.body.data.donations).toHaveLength(1);
    expect((await call(f.otherDonor, 'get', '/donors/me/donations')).body.data.donations).toHaveLength(0);
    expect((await call(f.otherStaff, 'get', `/requests/${r.id}/donations`)).status).toBe(404);
    expect((await call(f.admin, 'get', '/admin/donations')).body.data.pagination.total).toBe(1);
    for (const field of ['phone', 'email', 'coordinates', 'password']) expect(JSON.stringify(own.body)).not.toContain(field);
    await expect(Donation.updateOne({}, { units: 3 })).rejects.toThrow('append-only');
  });
  it('does not require location consent at confirmation of an actual accepted donation', async () => {
    await accept(); await User.updateOne({ _id: f.donor._id }, { availabilityStatus: 'UNAVAILABLE', locationSharingEnabled: false }); expect((await confirm()).status).toBe(200);
  });
  it('rejects a declined donor', async () => {
    await accept(); await DonorResponse.updateOne({ donor: f.donor._id }, { status: 'DECLINED' }); expect((await confirm()).status).toBe(409);
  });
});
describe('derived operational matching pause', () => {
  it.each([[0, true], [56 * 86400000 - 1, true], [56 * 86400000, false], [56 * 86400000 + 1, false], [-1, true]])('pause boundary at age %d milliseconds', (age, expected) => {
    const now = new Date('2026-10-30T12:00:00Z'); expect(isDonationPaused({ lastConfirmedDonationAt: new Date(now.getTime() - age) }, 56, now)).toBe(expected);
  });
  it('missing donation means no pause; invalid state fails closed', () => {
    expect(isDonationPaused({}, 56)).toBe(false); expect(isDonationPaused({ lastConfirmedDonationAt: 'bad' }, 56)).toBe(true); expect(isDonationPaused({ lastConfirmedDonationAt: new Date('bad') }, 56)).toBe(true);
  });
  it('confirmed donations leave ordinary matching until the configured pause boundary', async () => {
    await accept(); await confirm(); const matching = createMatchingService(config); const time = new Date();
    const query = { recipientBloodType: 'O+', requestLocation: point, radiusKm: 5, now: time };
    expect((await matching.findCandidates(query)).candidateCount).toBe(0);
    await User.updateOne({ _id: f.donor._id }, { lastConfirmedDonationAt: new Date(time.getTime() - config.DONATION_MATCHING_PAUSE_DAYS * 86400000) });
    expect((await matching.findCandidates(query)).candidateCount).toBe(1);
  });
  it('acceptance rechecks a recently confirmed donation pause', async () => {
    await call(f.staff, 'post', `/requests/${r.id}/broadcast`, { idempotencyKey: randomUUID() }); const n = await Notification.findOne();
    await User.updateOne({ _id: f.donor._id }, { lastConfirmedDonationAt: new Date() });
    expect((await call(f.donor, 'post', `/notifications/${n.id}/response`, { status: 'ACCEPTED' })).body.error.code).toBe('DONOR_NOT_ELIGIBLE');
  });
  it.each(['0', '-1', '1.5', '366', 'bad'])('validates pause configuration %s', value => {
    expect(() => parseEnv({ MONGODB_URI: 'mongodb://127.0.0.1/test', JWT_SECRET: 'test-only-long-configuration-secret', DONATION_MATCHING_PAUSE_DAYS: value })).toThrow('DONATION_MATCHING_PAUSE_DAYS');
  });
});
