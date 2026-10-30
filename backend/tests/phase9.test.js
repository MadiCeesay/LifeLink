import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { setupWorkflow, fixtures, client, createRequest, config, token } from './helpers/workflow.js';
import { User } from '../src/models/User.js';
import { BloodRequest } from '../src/models/BloodRequest.js';
import { Notification } from '../src/models/Notification.js';
import { DonorResponse } from '../src/models/DonorResponse.js';
import { Donation } from '../src/models/Donation.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { createApp } from '../src/app.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
let env, f;
beforeAll(async () => { env = await setupWorkflow(); }); beforeEach(async () => { f = await fixtures(); }); afterEach(() => vi.restoreAllMocks()); afterAll(async () => { await env?.close(); });
const call = (actor, method, path, body) => client(env.app, actor, method, path, body);
async function notified() { const r = await createRequest(env.app, f.staff); await call(f.staff, 'post', `/requests/${r.id}/broadcast`, { idempotencyKey: randomUUID() }); return { r, n: await Notification.findOne({ recipient: f.donor._id }) }; }
describe('adversarial authentication and account controls', () => {
  it('rejects signed tokens without expiration', async () => {
    const raw = jwt.sign({}, config.JWT_SECRET, { issuer: 'lifelink', audience: 'lifelink-api', subject: f.donor.id });
    expect((await request(env.app).get('/api/v1/auth/me').auth(raw, { type: 'bearer' })).status).toBe(401);
  });
  it.each(['HS384', 'HS512', 'none'])('rejects unexpected JWT algorithm %s', async algorithm => {
    const raw = jwt.sign({}, algorithm === 'none' ? null : config.JWT_SECRET, { algorithm, issuer: 'lifelink', audience: 'lifelink-api', subject: f.donor.id, expiresIn: '1h' });
    expect((await request(env.app).get('/api/v1/auth/me').auth(raw, { type: 'bearer' })).status).toBe(401);
  });
  it('rejects excessive token lifetime and future-issued tokens', async () => {
    for (const payload of [{}, { iat: Math.floor(Date.now() / 1000) + 3600 }]) {
      const raw = jwt.sign(payload, config.JWT_SECRET, { issuer: 'lifelink', audience: 'lifelink-api', subject: f.donor.id, expiresIn: payload.iat ? '1h' : '2d' });
      expect((await request(env.app).get('/api/v1/auth/me').auth(raw, { type: 'bearer' })).status).toBe(401);
    }
  });
  it('revokes old tokens across account deactivation and reactivation; fresh login works', async () => {
    const old = token(f.donor); const path = `/admin/accounts/${f.donor.id}/status`;
    await call(f.admin, 'patch', path, { isActive: false, reasonCode: 'SECURITY_REVIEW' }); await call(f.admin, 'patch', path, { isActive: true, reasonCode: 'ACCOUNT_REVIEW' });
    expect((await request(env.app).get('/api/v1/auth/me').auth(old, { type: 'bearer' })).status).toBe(401);
    const login = await request(env.app).post('/api/v1/auth/login').send({ email: f.donor.email, password: 'test-only-password-123' }); expect(login.status).toBe(200);
    expect((await request(env.app).get('/api/v1/auth/me').auth(login.body.data.accessToken, { type: 'bearer' })).status).toBe(200);
    expect(login.body.data.user.tokenVersion).toBeUndefined();
  });
  it('cannot bypass self-deactivation protection with uppercase IDs', async () => {
    await User.create({ ...f.admin.toObject(), _id: undefined, email: 'secondadmin@example.com' });
    expect((await call(f.admin, 'patch', `/admin/accounts/${f.admin.id.toUpperCase()}/status`, { isActive: false, reasonCode: 'ACCOUNT_REVIEW' })).body.error.code).toBe('SELF_DEACTIVATION_DENIED');
  });
  it('concurrent admin deactivation attempts preserve an active administrator', async () => {
    const second = await User.create({ ...f.admin.toObject(), _id: undefined, email: 'secondadmin@example.com' });
    const results = await Promise.all([call(f.admin, 'patch', `/admin/accounts/${second.id}/status`, { isActive: false, reasonCode: 'ACCOUNT_REVIEW' }), call(second, 'patch', `/admin/accounts/${f.admin.id}/status`, { isActive: false, reasonCode: 'ACCOUNT_REVIEW' })]);
    expect(results.filter(r => r.status === 200)).toHaveLength(1); expect(await User.countDocuments({ role: 'ADMIN', isActive: true })).toBe(1);
  });
});
describe('IDOR, privacy and injection', () => {
  it('a fresh GPS payload cannot bypass the confirmed-donation pause', async () => {
    const { n } = await notified(); await User.updateOne({ _id: f.donor._id }, { lastConfirmedDonationAt: new Date() });
    const res = await call(f.donor, 'post', `/notifications/${n.id}/response`, { status: 'ACCEPTED', location: { type: 'Point', coordinates: [-16.6669, 13.4549] } });
    expect(res.status).toBe(409); expect(res.body.error.code).toBe('DONOR_NOT_ELIGIBLE'); expect(await DonorResponse.countDocuments()).toBe(0);
  });
  it('does not expose accepted contact after donor deactivation or verification suspension', async () => {
    const { r, n } = await notified(); await call(f.donor, 'post', `/notifications/${n.id}/response`, { status: 'ACCEPTED' });
    await User.updateOne({ _id: f.donor._id }, { isActive: false }); expect((await call(f.staff, 'get', `/requests/${r.id}/responses`)).body.data.responses[0].donor).toBeNull();
    await User.updateOne({ _id: f.donor._id }, { isActive: true, 'donorVerification.status': 'SUSPENDED' }); expect((await call(f.staff, 'get', `/requests/${r.id}/responses`)).body.data.responses[0].donor).toBeNull();
  });
  it.each([
    ['post', '/auth/login', { email: { $ne: null }, password: 'anything' }],
    ['post', '/auth/register', { name: 'Test', email: 'new@example.com', phone: '+220 300 2222', password: 'long-test-password', role: 'ADMIN' }],
    ['post', '/requests', { patientBloodType: { $in: ['O+'] }, unitsNeeded: 1, urgency: 'URGENT', expiresAt: new Date(Date.now() + 3600000).toISOString() }],
    ['patch', '/donors/me/location-sharing', { locationSharingEnabled: true, role: 'ADMIN' }],
  ])('rejects injected/mass-assigned %s %s', async (method, path, body) => { expect((await call(path.startsWith('/donors') ? f.donor : f.staff, method, path, body)).status).toBe(400); });
  it.each(['/requests?status[$ne]=CANCELLED', '/requests?limit=999999', '/admin/audit-logs?actor[$ne]=null'])('rejects unsafe query %s', async path => { expect((await call(f.admin, 'get', path)).status).toBe(400); });
  it('rejects prototype fields without changing object prototypes', async () => {
    const body = JSON.parse('{"locationSharingEnabled":true,"__proto__":{"polluted":true}}');
    expect((await call(f.donor, 'patch', '/donors/me/location-sharing', body)).status).toBe(400); expect({}.polluted).toBeUndefined();
  });
  it.each(['donor', 'staff', 'otherStaff', 'anonymous'])('protects admin resources from %s', async role => {
    const actor = role === 'anonymous' ? null : f[role];
    for (const path of ['/admin/stats', '/admin/audit-logs', '/admin/donations']) expect((await call(actor, 'get', path)).status).toBe(role === 'anonymous' ? 401 : 403);
  });
  it('broadcast limiting is separate, authenticated and consistently shaped', async () => {
    const app = createApp({ ...config, BROADCAST_RATE_LIMIT: 2 }, { apiLimit: 1000 }); const r = await createRequest(app, f.staff);
    for (let i = 0; i < 2; i++) expect((await client(app, f.staff, 'post', `/requests/${r.id}/broadcast`, { idempotencyKey: randomUUID() })).status).toBe(200);
    const res = await client(app, f.staff, 'post', `/requests/${r.id}/broadcast`, { idempotencyKey: randomUUID() }); expect(res.status).toBe(429); expect(res.body.error.code).toBe('RATE_LIMITED'); expect(res.headers['cache-control']).toBe('no-store');
  });
});
describe('reliability, cancellation races and indexes', () => {
  it('serializes cancellation versus donor response', async () => {
    const { r, n } = await notified();
    const results = await Promise.all([call(f.staff, 'patch', `/requests/${r.id}/cancel`, { reason: 'No longer required' }), call(f.donor, 'post', `/notifications/${n.id}/response`, { status: 'ACCEPTED' })]);
    expect(results[0].status).toBe(200); expect([200, 409]).toContain(results[1].status); expect((await BloodRequest.findById(r.id)).status).toBe('CANCELLED');
    expect((await call(f.donor, 'post', `/notifications/${n.id}/response`, { status: 'ACCEPTED' })).status).toBe(409);
  });
  it('serializes cancellation versus broadcast without orphan notification state', async () => {
    const r = await createRequest(env.app, f.staff);
    const results = await Promise.all([call(f.staff, 'patch', `/requests/${r.id}/cancel`, { reason: 'No longer required' }), call(f.staff, 'post', `/requests/${r.id}/broadcast`, { idempotencyKey: randomUUID() })]);
    expect(results[0].status).toBe(200); expect([200, 409]).toContain(results[1].status);
    expect(await Notification.countDocuments()).toBe(results[1].status === 200 ? 1 : 0);
  });
  it('audit insertion failure rolls back donor response', async () => {
    const { n } = await notified(); vi.spyOn(AuditLog, 'create').mockRejectedValueOnce(new Error('simulated audit failure'));
    expect((await call(f.donor, 'post', `/notifications/${n.id}/response`, { status: 'ACCEPTED' })).status).toBe(500); expect(await DonorResponse.countDocuments()).toBe(0);
  });
  it('unique and access-path indexes exist for all workflow collections', async () => {
    for (const [model, keys] of [[Notification, ['bloodRequest', 'recipient', 'channel']], [DonorResponse, ['bloodRequest', 'donor']], [Donation, ['bloodRequest', 'donor']]]) {
      const indexes = await model.collection.indexes(); expect(indexes.some(i => i.unique && keys.every(k => Object.hasOwn(i.key, k)))).toBe(true);
    }
    expect((await User.collection.indexes()).some(i => i.key.currentLocation === '2dsphere')).toBe(true);
    expect((await User.collection.indexes()).some(i => i.key.role === 1 && i.key.isActive === 1)).toBe(true);
    for (const name of ['facilities', 'bloodrequests', 'broadcasts', 'auditlogs']) expect((await mongoose.connection.collection(name).indexes()).length).toBeGreaterThan(1);
  });
  it.each(['MongoServerSelectionError', 'MongoNetworkError', 'MongoNotConnectedError'])('returns safe production-style database failure: %s', async name => {
    const app = express(); app.get('/', () => { const error = new Error('mongodb://secret-credentials@example.invalid'); error.name = name; throw error; }); app.use(errorHandler);
    const res = await request(app).get('/'); expect(res.status).toBe(503); expect(res.body.error.code).toBe('DATABASE_UNAVAILABLE'); expect(JSON.stringify(res.body)).not.toContain('secret'); expect(res.body.error.stack).toBeUndefined();
  });
  it('does not mislabel every duplicate-key error as an email collision', async () => {
    const app = express(); app.get('/', () => { const error = new Error('private index details'); error.code = 11000; error.keyPattern = { bloodRequest: 1, donor: 1 }; throw error; }); app.use(errorHandler);
    const res = await request(app).get('/'); expect(res.status).toBe(409); expect(res.body.error.code).toBe('RESOURCE_CONFLICT'); expect(JSON.stringify(res.body)).not.toContain('private');
  });
});

it('notification inbox can recover only the authenticated donor response state', async () => {
  const { n } = await notified();
  expect((await call(f.donor, 'get', '/notifications')).body.data.notifications[0].responseStatus).toBe('PENDING');
  await call(f.donor, 'post', `/notifications/${n.id}/response`, { status: 'ACCEPTED' });
  expect((await call(f.donor, 'get', '/notifications')).body.data.notifications[0].responseStatus).toBe('ACCEPTED');
  expect((await call(f.donor, 'patch', `/notifications/${n.id}/read`)).body.data.responseStatus).toBe('ACCEPTED');
  expect((await call(f.otherDonor, 'get', '/notifications')).body.data.notifications).toHaveLength(0);
});
