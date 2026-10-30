import { beforeAll, afterAll, beforeEach, afterEach, it, expect, vi, describe } from 'vitest';
import { randomUUID } from 'node:crypto';
import { setupWorkflow, fixtures, client, createRequest } from './helpers/workflow.js';
import { User } from '../src/models/User.js';
import { Facility } from '../src/models/Facility.js';
import { BloodRequest } from '../src/models/BloodRequest.js';
import { Notification } from '../src/models/Notification.js';
import { Broadcast } from '../src/models/Broadcast.js';
import { DonorResponse } from '../src/models/DonorResponse.js';
import { notificationProvider } from '../src/services/notificationProviders.js';
let env, f, r;
beforeAll(async () => { env = await setupWorkflow(); });
beforeEach(async () => { f = await fixtures(); r = await createRequest(env.app, f.staff); });
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { await env?.close(); });
const call = (actor, method, path, body) => client(env.app, actor, method, path, body);
const broadcast = (body = {}, actor) => call(actor ?? f.staff, 'post', `/requests/${r.id}/broadcast`, { idempotencyKey: randomUUID(), ...body });
async function notify() { const sent = await broadcast(); expect(sent.status).toBe(200); return Notification.findOne({ recipient: f.donor._id }); }
const respond = (n, status = 'ACCEPTED', actor, extra = {}) => call(actor ?? f.donor, 'post', `/notifications/${n.id}/response`, { status, ...extra });
describe('in-app delivery and expansion', () => {
  it('creates a persistent in-app notification with no candidate PII in broadcast results', async () => {
    const res = await broadcast(); expect(res.status).toBe(200); expect(res.body.data.notifiedCount).toBe(1); expect(res.body.data.radiusUsedKm).toBe(5);
    const n = await Notification.findOne(); expect(n.channel).toBe('IN_APP'); expect(n.status).toBe('DELIVERED'); expect(n.sentAt).toBeInstanceOf(Date);
    const json = JSON.stringify(res.body); for (const secret of ['coordinates', 'phone', 'email', f.donor.id]) expect(json).not.toContain(secret);
  });
  it('deduplicates identical and distinct repeated broadcast operations', async () => {
    const key = randomUUID(); await broadcast({ idempotencyKey: key }); await broadcast({ idempotencyKey: key }); await broadcast();
    expect(await Notification.countDocuments()).toBe(1); expect(await Broadcast.countDocuments()).toBe(2);
  });
  it('supports concurrent identical idempotent broadcasts without duplicates', async () => {
    const key = randomUUID(); const results = await Promise.all([broadcast({ idempotencyKey: key }), broadcast({ idempotencyKey: key })]);
    expect(results.map(x => x.status)).toEqual([200, 200]); expect(await Notification.countDocuments()).toBe(1); expect(await Broadcast.countDocuments()).toBe(1);
  });
  it('starts locally and explicitly expands to the next configured radius without renotifying', async () => {
    const far = await User.create({ ...f.donor.toObject(), _id: undefined, email: 'far@example.com', currentLocation: { type: 'Point', coordinates: [-16.6269, 13.4549] } });
    expect((await broadcast()).body.data.notifiedCount).toBe(1); expect(await Notification.exists({ recipient: far._id })).toBeNull();
    const expanded = await broadcast({ expand: true }); expect(expanded.body.data.radiusUsedKm).toBe(10); expect(expanded.body.data.notifiedCount).toBe(1);
    expect(await Notification.countDocuments({ recipient: f.donor._id })).toBe(1); expect(await Notification.countDocuments()).toBe(2);
  });
  it('does not expand indefinitely', async () => {
    await broadcast(); for (let i = 0; i < 3; i++) expect((await broadcast({ expand: true })).status).toBe(200);
    expect((await broadcast({ expand: true })).body.error.code).toBe('RADIUS_EXHAUSTED');
  });
  it('does not claim unconfigured external delivery', () => { for (const channel of ['SMS', 'EMAIL', 'WHATSAPP', 'PUSH']) expect(() => notificationProvider(channel)).toThrow('not configured'); });
  it('requires ownership and management permission', async () => {
    expect((await broadcast({}, f.otherStaff)).status).toBe(404);
    expect((await broadcast({}, f.donor)).status).toBe(403);
    await User.updateOne({ _id: f.staff._id }, { facilityPermissions: ['CREATE_BLOOD_REQUESTS'] }); expect((await broadcast()).status).toBe(403);
  });
  it('rolls back the complete broadcast if notification creation fails', async () => {
    vi.spyOn(Notification, 'create').mockRejectedValueOnce(new Error('simulated insert failure'));
    expect((await broadcast()).status).toBe(500); expect(await Notification.countDocuments()).toBe(0); expect(await Broadcast.countDocuments()).toBe(0);
    expect((await BloodRequest.findById(r.id)).broadcastStage).toBe(-1);
  });
});
describe('notification ownership and final donor responses', () => {
  it('lists only own notifications and read state is idempotent', async () => {
    const n = await notify();
    expect((await call(f.donor, 'get', '/notifications?unread=true')).body.data.pagination.total).toBe(1);
    expect((await call(f.otherDonor, 'get', '/notifications')).body.data.pagination.total).toBe(0);
    expect((await call(f.otherDonor, 'patch', `/notifications/${n.id}/read`)).status).toBe(404);
    const first = await call(f.donor, 'patch', `/notifications/${n.id}/read`); const second = await call(f.donor, 'patch', `/notifications/${n.id}/read`);
    expect(first.body.data.status).toBe('READ'); expect(second.body.data.readAt).toBe(first.body.data.readAt);
    expect((await call(f.staff, 'get', '/notifications')).status).toBe(403);
  });
  it('accepts a notified eligible donor but does not count a donation', async () => {
    const n = await notify(); const accepted = await respond(n); expect(accepted.status).toBe(200); expect(accepted.body.data.status).toBe('ACCEPTED');
    expect((await BloodRequest.findById(r.id)).unitsReceived).toBe(0); expect(await DonorResponse.countDocuments()).toBe(1);
  });
  it('allows a notified donor to decline even if no longer available', async () => {
    const n = await notify(); await User.updateOne({ _id: f.donor._id }, { availabilityStatus: 'UNAVAILABLE' }); expect((await respond(n, 'DECLINED')).status).toBe(200);
  });
  it('rejects a non-notified donor using someone else notification', async () => {
    const n = await notify(); expect((await respond(n, 'ACCEPTED', f.otherDonor)).status).toBe(404);
  });
  it.each(['UNVERIFIED', 'SUSPENDED', 'REQUIRES_REVERIFICATION'])('rechecks verification state: %s', async status => {
    const n = await notify(); await User.updateOne({ _id: f.donor._id }, { 'donorVerification.status': status }); expect((await respond(n)).status).toBe(409);
  });
  it.each([
    { availabilityStatus: 'UNAVAILABLE' }, { locationSharingEnabled: false }, { locationUpdatedAt: new Date(0) },
    { 'donorVerification.verifiedBloodType': 'A+' }, { currentLocation: { type: 'Point', coordinates: [0, 0] } },
  ])('rechecks current acceptance eligibility %#', async patch => {
    const n = await notify(); await User.updateOne({ _id: f.donor._id }, patch); expect((await respond(n)).status).toBe(409);
  });
  it('acceptance can atomically refresh stale device location without enabling consent', async () => {
    const n = await notify(); await User.updateOne({ _id: f.donor._id }, { locationUpdatedAt: new Date(0) });
    const res = await respond(n, 'ACCEPTED', f.donor, { location: { type: 'Point', coordinates: [-16.6669, 13.4549] } }); expect(res.status).toBe(200);
  });
  it.each(['EXPIRED', 'CANCELLED', 'FULFILLED'])('rejects responses and broadcasts for %s requests', async status => {
    const n = await notify(); await BloodRequest.updateOne({ _id: r.id }, { status });
    expect((await respond(n)).status).toBe(409); expect((await broadcast()).status).toBe(409);
  });
  it('enforces expiry even if persisted status is still OPEN', async () => {
    const n = await notify(); await BloodRequest.collection.updateOne({ _id: n.bloodRequest }, { $set: { expiresAt: new Date(0) } }); expect((await respond(n)).status).toBe(409);
  });
  it('rejects inactive donors and suspended requesting facilities', async () => {
    const n = await notify(); await Facility.updateOne({ _id: f.facility._id }, { verificationStatus: 'SUSPENDED' }); expect((await respond(n)).status).toBe(409);
    await User.updateOne({ _id: f.donor._id }, { isActive: false }); expect((await respond(n)).status).toBe(401);
  });
  it('makes identical concurrent responses idempotent and rejects changing the final response', async () => {
    const n = await notify(); const results = await Promise.all([respond(n), respond(n)]); expect(results.map(x => x.status)).toEqual([200, 200]);
    expect(await DonorResponse.countDocuments()).toBe(1); expect((await respond(n, 'DECLINED')).body.error.code).toBe('RESPONSE_FINAL');
  });
  it('reveals accepted contact only to the owning authorized facility, never GPS or email', async () => {
    const n = await notify(); await respond(n);
    const res = await call(f.staff, 'get', `/requests/${r.id}/responses`); expect(res.status).toBe(200); expect(res.body.data.responses[0].donor.phone).toBe(f.donor.phone);
    for (const field of ['coordinates', 'email', 'password', 'verificationNotes']) expect(JSON.stringify(res.body)).not.toContain(field);
    expect((await call(f.otherStaff, 'get', `/requests/${r.id}/responses`)).status).toBe(404);
  });
  it('does not reveal declined donor contact', async () => {
    const n = await notify(); await respond(n, 'DECLINED'); const res = await call(f.staff, 'get', `/requests/${r.id}/responses`);
    expect(res.body.data.responses[0].donor).toBeNull(); expect(JSON.stringify(res.body)).not.toContain(f.donor.phone);
  });
  it('validates broadcast, response and notification identifiers', async () => {
    expect((await broadcast({ idempotencyKey: 'bad' })).status).toBe(400);
    expect((await broadcast({ requestLocation: { coordinates: [0, 0] } })).status).toBe(400);
    const n = await notify(); expect((await respond(n, 'DONATED')).status).toBe(400);
    expect((await call(f.donor, 'post', '/notifications/bad/response', { status: 'ACCEPTED' })).status).toBe(400);
  });
});
