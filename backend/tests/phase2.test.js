import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { createTestDatabase, createStandaloneTestDatabase } from './helpers/database.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { initializeDatabase } from '../src/config/initializeDatabase.js';
import { parseEnv } from '../src/config/env.js';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Facility } from '../src/models/Facility.js';
import { VerificationEvent } from '../src/models/VerificationEvent.js';
import { AdminBootstrap } from '../src/models/AdminBootstrap.js';
import { bootstrapAdmin } from '../src/services/bootstrapService.js';
import { createFacility } from '../src/services/facilityService.js';
import { verifyDonor } from '../src/services/verificationService.js';
import { BLOOD_TYPES } from '../src/config/domain.js';
import { backfillDonorVerification } from '../scripts/migrate-phase2.js';
const config = parseEnv({ NODE_ENV: 'test', MONGODB_URI: 'mongodb://127.0.0.1/test', JWT_SECRET: 'phase-two-test-secret-only-at-least-32-characters', CORS_ORIGINS: 'http://localhost:3000' });
const facilityInput = { name: 'Example Health Centre', facilityType: 'HEALTH_CENTRE', referenceNumber: 'EXAMPLE-REF', phone: '+220 300 1111', email: 'facility@example.com', address: 'Example address' };
const staffInput = { name: 'New Staff', email: 'new-staff@example.com', phone: '+220 300 2222', password: 'test-only-password-123' };
const reason = { reason: 'Reviewed for this test workflow' };
let mongo, app, password, admin, facility, staff, donor;
const token = user => jwt.sign({}, config.JWT_SECRET, { algorithm: 'HS256', issuer: 'lifelink', audience: 'lifelink-api', subject: user.id, expiresIn: '1h' });
const call = (method, path, user = admin, body) => {
  const req = request(app)[method](`/api/v1${path}`);
  if (user) req.auth(token(user), { type: 'bearer' });
  return body === undefined ? req : req.send(body);
};
const verify = (type = 'O+', user = staff, id = donor.id, extra = {}) => call('patch', `/donors/${id}/verification`, user, { verifiedBloodType: type, ...extra });
const status = (value, user = admin) => call('patch', `/admin/donors/${donor.id}/verification-status`, user, { status: value, ...reason });
async function user(role, email, extra = {}) {
  return User.create({ name: 'Example Account', email, phone: '+220 300 3333', password, role, ...extra });
}
async function otherFacility() {
  const second = await Facility.create({ ...facilityInput, name: 'Second Facility', createdBy: admin._id, verificationStatus: 'APPROVED' });
  return user('FACILITY_USER', 'second@example.com', { facility: second._id, facilityPermissions: ['VERIFY_DONORS'] });
}
beforeAll(async () => {
  mongo = await createTestDatabase();
  await connectDatabase(mongo.getUri());
  await initializeDatabase();
  password = await bcrypt.hash(staffInput.password, 12);
  app = createApp(config, { authLimit: 1000, apiLimit: 10000 });
});
beforeEach(async () => {
  // Raw history cleanup is limited to this disposable database; application APIs are append-only.
  await VerificationEvent.collection.deleteMany({});
  await Promise.all([User.deleteMany({}), Facility.deleteMany({}), AdminBootstrap.deleteMany({})]);
  admin = await user('ADMIN', 'admin@example.com');
  facility = await Facility.create({ ...facilityInput, verificationStatus: 'APPROVED', createdBy: admin._id, approvedBy: admin._id, approvedAt: new Date() });
  staff = await user('FACILITY_USER', 'staff@example.com', { facility: facility._id, facilityPermissions: ['VERIFY_DONORS'] });
  donor = await user('DONOR', 'donor@example.com');
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { await disconnectDatabase(); await mongo?.stop(); });
describe('facility lifecycle and admin access', () => {
  it('admin creates a pending facility with an explicit response', async () => {
    const res = await call('post', '/admin/facilities', admin, facilityInput);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ verificationStatus: 'PENDING', isActive: true });
    expect(res.body.data.authorizationVersion).toBeUndefined();
    expect(res.body.data.__v).toBeUndefined();
  });
  it.each(['DONOR', 'FACILITY_USER'])('rejects non-admin facility creation: %s', async role => {
    expect((await call('post', '/admin/facilities', role === 'DONOR' ? donor : staff, facilityInput)).status).toBe(403);
  });
  it('rejects unauthenticated facility creation', async () => { expect((await call('post', '/admin/facilities', null, facilityInput)).status).toBe(401); });
  it('lists, filters and retrieves facilities with bounded pagination', async () => {
    const pending = await call('post', '/admin/facilities', admin, facilityInput);
    const list = await call('get', '/admin/facilities?status=PENDING&limit=1&page=1');
    expect(list.status).toBe(200);
    expect(list.body.data.pagination.total).toBe(1);
    expect(list.body.data.facilities[0].id).toBe(pending.body.data.id);
    expect((await call('get', `/admin/facilities/${pending.body.data.id}`)).status).toBe(200);
  });
  it.each(['approve', 'reject'])('admin can %s pending facility and records the transition', async action => {
    const pending = await Facility.create({ ...facilityInput, createdBy: admin._id });
    const res = await call('patch', `/admin/facilities/${pending.id}/${action}`, admin, reason);
    expect(res.status).toBe(200);
    expect(res.body.data.verificationStatus).toBe(action === 'approve' ? 'APPROVED' : 'REJECTED');
    expect(res.body.data.statusHistory[0]).toMatchObject({ previousStatus: 'PENDING', performedBy: admin.id });
    if (action === 'approve') { expect(res.body.data.approvedAt).toBeTruthy(); expect(res.body.data.approvedBy).toBe(admin.id); }
    else { expect(res.body.data.isActive).toBe(false); expect(res.body.data.rejectionReason).toBe(reason.reason); }
  });
  it('suspends and reactivates an approved facility', async () => {
    const suspended = await call('patch', `/admin/facilities/${facility.id}/suspend`, admin, reason);
    expect(suspended.body.data).toMatchObject({ verificationStatus: 'SUSPENDED', isActive: false });
    expect((await verify()).status).toBe(403);
    const activated = await call('patch', `/admin/facilities/${facility.id}/reactivate`, admin, reason);
    expect(activated.body.data).toMatchObject({ verificationStatus: 'APPROVED', isActive: true });
    expect((await verify()).status).toBe(200);
  });
  it('reactivating a rejected facility returns it to pending review', async () => {
    await Facility.updateOne({ _id: facility._id }, { verificationStatus: 'REJECTED', isActive: false });
    expect((await call('patch', `/admin/facilities/${facility.id}/reactivate`, admin, reason)).body.data.verificationStatus).toBe('PENDING');
    expect((await verify()).status).toBe(403);
  });
  it.each(['approve', 'reject', 'reactivate'])('rejects invalid approved facility action: %s', async action => {
    const res = await call('patch', `/admin/facilities/${facility.id}/${action}`, admin, reason);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_FACILITY_TRANSITION');
  });
  it('prevents facility staff from changing approval state', async () => { expect((await call('patch', `/admin/facilities/${facility.id}/suspend`, staff, reason)).status).toBe(403); });
  it('rejects missing facility records', async () => { expect((await call('get', `/admin/facilities/${new mongoose.Types.ObjectId()}`)).status).toBe(404); });
  it('enforces admin business authorization even outside HTTP controllers', async () => { await expect(createFacility(donor._id, facilityInput)).rejects.toMatchObject({ code: 'FORBIDDEN' }); });
});
describe('staff provisioning and membership', () => {
  it('admin provisions associated staff with hashed credentials and no issued token', async () => {
    const res = await call('post', `/admin/facilities/${facility.id}/staff`, admin, staffInput);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ role: 'FACILITY_USER', facilityId: facility.id, permissions: ['VERIFY_DONORS'] });
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.data.accessToken).toBeUndefined();
    const stored = await User.findById(res.body.data.id).select('+password');
    expect(await bcrypt.compare(staffInput.password, stored.password)).toBe(true);
    const login = await request(app).post('/api/v1/auth/login').send({ email: staffInput.email, password: staffInput.password });
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe('FACILITY_USER');
  });
  it.each(['DONOR', 'FACILITY_USER'])('prevents %s from provisioning/promoting staff', async role => {
    expect((await call('post', `/admin/facilities/${facility.id}/staff`, role === 'DONOR' ? donor : staff, staffInput)).status).toBe(403);
  });
  it.each(['PENDING', 'REJECTED', 'SUSPENDED'])('rejects provisioning to %s facilities', async verificationStatus => {
    await Facility.updateOne({ _id: facility._id }, { verificationStatus });
    expect((await call('post', `/admin/facilities/${facility.id}/staff`, admin, staffInput)).status).toBe(409);
    expect(await User.exists({ email: staffInput.email })).toBeNull();
  });
  it('rejects duplicate staff email', async () => {
    const body = { ...staffInput, email: donor.email };
    expect((await call('post', `/admin/facilities/${facility.id}/staff`, admin, body)).status).toBe(409);
    expect((await User.findById(donor.id)).role).toBe('DONOR');
  });
  it('allows associated staff to view their facility without internal admin details', async () => {
    const res = await call('get', '/facilities/me', staff);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(facility.id);
    expect(res.body.data.createdBy).toBeUndefined();
    expect(res.body.data.statusHistory).toBeUndefined();
    expect(res.body.data.referenceNumber).toBeUndefined();
  });
  it('rejects unassociated facility users', async () => {
    await User.updateOne({ _id: staff._id }, { facility: null });
    expect((await call('get', '/facilities/me', staff)).status).toBe(403);
    expect((await verify()).status).toBe(403);
  });
  it('does not trust the role without the verification permission', async () => {
    await User.updateOne({ _id: staff._id }, { facilityPermissions: [] });
    expect((await call('get', '/facilities/me', staff)).status).toBe(200);
    expect((await verify()).status).toBe(403);
  });
  it('rejects inactive staff using previously issued tokens', async () => {
    await User.updateOne({ _id: staff._id }, { isActive: false });
    expect((await verify()).status).toBe(401);
  });
  it('checks facility membership on every request rather than trusting JWT claims', async () => {
    const savedToken = token(staff);
    await User.updateOne({ _id: staff._id }, { facility: null });
    expect((await request(app).patch(`/api/v1/donors/${donor.id}/verification`).auth(savedToken, { type: 'bearer' }).send({ verifiedBloodType: 'A+' })).status).toBe(403);
  });
});
describe('donor verification and transitions', () => {
  it('new registration starts unverified without requiring blood testing', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ ...staffInput, email: 'newdonor@example.com' });
    expect(res.status).toBe(201);
    const profile = await request(app).get('/api/v1/donors/me/verification').auth(res.body.data.accessToken, { type: 'bearer' });
    expect(profile.body.data).toEqual({ verificationStatus: 'UNVERIFIED', verifiedBloodType: null, verifiedAt: null, verifiedByFacility: null });
    expect((await User.findById(res.body.data.user.id)).donorVerification.status).toBe('UNVERIFIED');
  });
  it.each(BLOOD_TYPES)('accepts authorized verification of %s and records provenance/history', async bloodType => {
    const res = await verify(bloodType, staff, donor.id, { notes: 'Profile and blood group reviewed' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ verificationStatus: 'VERIFIED', verifiedBloodType: bloodType, verifiedByFacility: { id: facility.id } });
    const current = (await User.findById(donor.id)).donorVerification;
    expect(current.verifiedBy.toString()).toBe(staff.id);
    expect(current.verifiedByFacility.toString()).toBe(facility.id);
    expect(current.verifiedAt).toBeInstanceOf(Date);
    expect(current.revision).toBe(1);
    const event = await VerificationEvent.findOne({ donor: donor._id });
    expect(event).toMatchObject({ previousStatus: 'UNVERIFIED', newStatus: 'VERIFIED', verifiedBloodType: bloodType, sequence: 1 });
    expect(event.performedBy.toString()).toBe(staff.id);
    expect(event.facility.toString()).toBe(facility.id);
    expect(event.timestamp.getTime()).toBe(current.verifiedAt.getTime());
  });
  it.each(['PENDING', 'REJECTED', 'SUSPENDED'])('rejects verification by %s facilities', async verificationStatus => {
    await Facility.updateOne({ _id: facility._id }, { verificationStatus });
    expect((await verify()).status).toBe(403);
    expect(await VerificationEvent.countDocuments()).toBe(0);
  });
  it('rejects inactive facilities even if approved', async () => {
    await Facility.updateOne({ _id: facility._id }, { isActive: false });
    expect((await verify()).status).toBe(403);
  });
  it.each(['DONOR', 'ADMIN'])('rejects verification by arbitrary role %s', async role => {
    expect((await verify('A+', role === 'DONOR' ? donor : admin)).status).toBe(403);
  });
  it('rejects donor self-verification', async () => { expect((await verify('A+', donor, donor.id)).status).toBe(403); });
  it.each(['ADMIN', 'FACILITY_USER'])('only verifies DONOR accounts, not %s', async role => {
    expect((await verify('A+', staff, role === 'ADMIN' ? admin.id : staff.id)).status).toBe(404);
  });
  it('rejects inactive donors', async () => {
    await User.updateOne({ _id: donor._id }, { isActive: false });
    expect((await verify()).status).toBe(409);
    expect(await VerificationEvent.countDocuments()).toBe(0);
  });
  it('rejects repeat verification without authorized status transition', async () => {
    await verify();
    expect((await verify('A-')).status).toBe(409);
    expect(await VerificationEvent.countDocuments()).toBe(1);
  });
  it('admin requires reverification, staff verify again, preserving all events', async () => {
    await verify('A+');
    expect((await status('REQUIRES_REVERIFICATION')).status).toBe(200);
    expect((await verify('O+')).status).toBe(200);
    const events = await VerificationEvent.find().sort({ sequence: 1 });
    expect(events.map(e => e.newStatus)).toEqual(['VERIFIED', 'REQUIRES_REVERIFICATION', 'VERIFIED']);
    expect(events[0].verifiedBloodType).toBe('A+');
    expect(events[2].verifiedBloodType).toBe('O+');
    expect(events[1].performedBy.toString()).toBe(admin.id);
    expect((await User.findById(donor.id)).donorVerification.revision).toBe(3);
  });
  it('suspension blocks staff until admin explicitly requires reverification', async () => {
    await verify();
    expect((await status('SUSPENDED')).status).toBe(200);
    expect((await verify()).status).toBe(409);
    expect((await status('REQUIRES_REVERIFICATION')).status).toBe(200);
    expect((await verify()).status).toBe(200);
    expect(await VerificationEvent.countDocuments()).toBe(4);
  });
  it('retains blood type and provenance when suspended but reports the suspended state', async () => {
    await verify('B-'); await status('SUSPENDED');
    const res = await call('get', '/donors/me/verification', donor);
    expect(res.body.data).toMatchObject({ verificationStatus: 'SUSPENDED', verifiedBloodType: 'B-', verifiedByFacility: { id: facility.id } });
  });
  it('rejects invalid donor status transitions', async () => { expect((await status('REQUIRES_REVERIFICATION')).status).toBe(409); });
  it('staff cannot change administrative verification state', async () => {
    await verify(); expect((await status('SUSPENDED', staff)).status).toBe(403);
  });
  it('enforces business authorization when services are called directly', async () => {
    await expect(verifyDonor(donor._id, donor.id, { verifiedBloodType: 'A+' })).rejects.toMatchObject({ code: 'FACILITY_ACCESS_DENIED' });
  });
});
describe('privacy, scope and input validation', () => {
  it('uses exact-ID lookup with only minimum identity data', async () => {
    const res = await call('get', `/donors/${donor.id}/verification`, staff);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual(['id', 'name', 'verificationStatus', 'verifiedBloodType']);
    expect((await call('get', '/donors', staff)).status).toBe(404);
  });
  it('does not reveal internal staff, notes or account details in donor status', async () => {
    await verify('O+', staff, donor.id, { notes: 'Internal review note' });
    const res = await call('get', '/donors/me/verification', donor);
    const encoded = JSON.stringify(res.body);
    expect(encoded).not.toContain(staff.id);
    expect(encoded).not.toContain('Internal review note');
    expect(encoded).not.toContain('password');
    expect(Object.keys(res.body.data.verifiedByFacility).sort()).toEqual(['facilityType', 'id', 'name']);
  });
  it('donor cannot read another donor status or private history', async () => {
    await verify();
    const other = await user('DONOR', 'otherdonor@example.com');
    expect((await call('get', `/donors/${donor.id}/verification`, other)).status).toBe(403);
    expect((await call('get', `/donors/${donor.id}/verification-history`, other)).status).toBe(403);
    expect((await call('get', `/admin/donors/${donor.id}/verification-history`, other)).status).toBe(403);
  });
  it('unrelated facility staff cannot read verified donor profile or history', async () => {
    await verify();
    const second = await otherFacility();
    expect((await call('get', `/donors/${donor.id}/verification`, second)).status).toBe(403);
    expect((await call('get', `/donors/${donor.id}/verification-history`, second)).status).toBe(403);
  });
  it('history is scoped to the acting facility after cross-facility reverification', async () => {
    await verify('A+'); await status('REQUIRES_REVERIFICATION');
    const second = await otherFacility();
    expect((await verify('B+', second)).status).toBe(200);
    const originalHistory = await call('get', `/donors/${donor.id}/verification-history`, staff);
    expect(originalHistory.body.data.events).toHaveLength(2);
    expect(originalHistory.body.data.events.every(e => e.facilityId === facility.id)).toBe(true);
    const secondHistory = await call('get', `/donors/${donor.id}/verification-history`, second);
    expect(secondHistory.body.data.events).toHaveLength(1);
    const all = await call('get', `/admin/donors/${donor.id}/verification-history?limit=2`, admin);
    expect(all.body.data.pagination.total).toBe(3);
    expect(all.body.data.events).toHaveLength(2);
    expect(all.body.data.events[0].sequence).toBe(3);
  });
  it.each([
    { verifiedBloodType: 'INVALID' }, { verifiedBloodType: 'A+', facilityId: 'other' },
    { verifiedBloodType: 'A+', verifiedBy: 'other' }, { verifiedBloodType: 'A+', status: 'VERIFIED' },
    { verifiedBloodType: 'A+', notes: 'x'.repeat(1001) }, {},
  ])('rejects invalid/forged verification payload %#', async body => {
    const res = await call('patch', `/donors/${donor.id}/verification`, staff, body);
    expect(res.status).toBe(400); expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await VerificationEvent.countDocuments()).toBe(0);
  });
  it.each([
    { ...facilityInput, verificationStatus: 'APPROVED' }, { ...facilityInput, isActive: false },
    { ...facilityInput, facilityType: 'UNKNOWN' }, { ...facilityInput, location: { coordinates: [0, 0] } },
    { ...facilityInput, email: 'bad' },
  ])('rejects dangerous facility payload %#', async body => { expect((await call('post', '/admin/facilities', admin, body)).status).toBe(400); });
  it.each([
    { ...staffInput, role: 'ADMIN' }, { ...staffInput, facility: 'other' },
    { ...staffInput, permissions: ['ADMIN'] }, { ...staffInput, permissions: ['VERIFY_DONORS', 'VERIFY_DONORS'] },
  ])('rejects dangerous staff payload %#', async body => { expect((await call('post', `/admin/facilities/${facility.id}/staff`, admin, body)).status).toBe(400); });
  it.each(['/admin/facilities/bad', '/donors/bad/verification', '/donors/bad/verification-history'])('handles malformed IDs: %s', async path => {
    const res = await call('get', path, path.startsWith('/admin') ? admin : staff);
    expect(res.status).toBe(400); expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
  it.each(['/admin/facilities?limit=101', '/admin/facilities?page=0', '/admin/facilities?status=UNKNOWN', '/admin/facilities?unknown=true'])('validates list query: %s', async path => { expect((await call('get', path)).status).toBe(400); });
  it('rejects empty facility action reasons and arbitrary donor verification states', async () => {
    expect((await call('patch', `/admin/facilities/${facility.id}/suspend`, admin, {})).status).toBe(400);
    expect((await call('patch', `/admin/donors/${donor.id}/verification-status`, admin, { status: 'VERIFIED', ...reason })).status).toBe(400);
  });
  it('does not expose history write/delete endpoints or allow history model mutations', async () => {
    await verify();
    expect((await call('delete', `/donors/${donor.id}/verification-history`, staff)).status).toBe(404);
    await expect(VerificationEvent.updateOne({}, { notes: 'changed' })).rejects.toThrow('append-only');
    await expect(VerificationEvent.deleteOne({})).rejects.toThrow('append-only');
  });
});
describe('transaction consistency and concurrency', () => {
  it('rolls back donor state when verification-history insertion fails', async () => {
    vi.spyOn(VerificationEvent, 'create').mockRejectedValueOnce(new Error('simulated audit insert failure'));
    const res = await verify();
    expect(res.status).toBe(500);
    expect((await User.findById(donor.id)).donorVerification.status).toBe('UNVERIFIED');
    expect(await VerificationEvent.countDocuments()).toBe(0);
  });
  it('rolls back administrative state change if history insertion fails', async () => {
    await verify();
    vi.spyOn(VerificationEvent, 'create').mockRejectedValueOnce(new Error('simulated audit insert failure'));
    expect((await status('SUSPENDED')).status).toBe(500);
    expect((await User.findById(donor.id)).donorVerification.status).toBe('VERIFIED');
    expect(await VerificationEvent.countDocuments()).toBe(1);
  });
  it('serializes simultaneous verifications without duplicate history', async () => {
    const colleague = await user('FACILITY_USER', 'colleague@example.com', { facility: facility._id, facilityPermissions: ['VERIFY_DONORS'] });
    const results = await Promise.all([verify('A+', staff), verify('B+', colleague)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await VerificationEvent.countDocuments()).toBe(1);
    const event = await VerificationEvent.findOne();
    expect((await User.findById(donor.id)).donorVerification.verifiedBloodType).toBe(event.verifiedBloodType);
  });
  it('serializes facility suspension against verification and blocks subsequent writes', async () => {
    const [verification, suspension] = await Promise.all([verify(), call('patch', `/admin/facilities/${facility.id}/suspend`, admin, reason)]);
    expect(suspension.status).toBe(200);
    expect([200, 403]).toContain(verification.status);
    expect(await VerificationEvent.countDocuments()).toBe(verification.status === 200 ? 1 : 0);
    expect((await verify()).status).toBe(403);
  });
});
describe('initial administrator bootstrap', () => {
  it('creates one admin with hashed password, without requiring a public endpoint', async () => {
    await User.deleteOne({ _id: admin._id });
    const created = await bootstrapAdmin({ ...staffInput, email: 'bootstrap@example.com' });
    const stored = await User.findById(created.id).select('+password');
    expect(stored.role).toBe('ADMIN');
    expect(await bcrypt.compare(staffInput.password, stored.password)).toBe(true);
    expect(await AdminBootstrap.countDocuments()).toBe(1);
    await expect(bootstrapAdmin({ ...staffInput, email: 'secondadmin@example.com' })).rejects.toMatchObject({ code: 'BOOTSTRAP_DISABLED' });
    expect((await call('post', '/auth/bootstrap-admin', null, staffInput)).status).toBe(404);
  });
  it('refuses to bootstrap when an administrator already exists', async () => {
    await expect(bootstrapAdmin(staffInput)).rejects.toMatchObject({ code: 'BOOTSTRAP_DISABLED' });
    expect(await AdminBootstrap.countDocuments()).toBe(0);
  });
  it('serializes concurrent bootstrap attempts', async () => {
    await User.deleteOne({ _id: admin._id });
    const results = await Promise.allSettled([bootstrapAdmin({ ...staffInput, email: 'bootstrap1@example.com' }), bootstrapAdmin({ ...staffInput, email: 'bootstrap2@example.com' })]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await User.countDocuments({ role: 'ADMIN' })).toBe(1);
    expect(await AdminBootstrap.countDocuments()).toBe(1);
  });
});

describe('upgrade and topology safeguards', () => {
  it('backfills only legacy donors and remains idempotent without rewriting trusted history', async () => {
    await verify('AB-');
    const legacy = await user('DONOR', 'legacy@example.com');
    await User.collection.updateOne({ _id: legacy._id }, { $unset: { donorVerification: '' } });
    const first = await backfillDonorVerification();
    expect(first.modifiedCount).toBe(1);
    expect((await User.findById(legacy.id)).donorVerification.status).toBe('UNVERIFIED');
    expect((await User.findById(donor.id)).donorVerification.verifiedBloodType).toBe('AB-');
    expect(await VerificationEvent.countDocuments()).toBe(1);
    expect((await backfillDonorVerification()).modifiedCount).toBe(0);
    expect((await User.findById(admin.id)).role).toBe('ADMIN');
  });
  it('rejects standalone MongoDB before enabling trusted operations', async () => {
    let standalone;
    await disconnectDatabase();
    try {
      standalone = await createStandaloneTestDatabase();
      await connectDatabase(standalone.getUri());
      await expect(initializeDatabase()).rejects.toThrow('Phase 2 requires MongoDB transactions');
    } finally {
      await disconnectDatabase();
      await standalone?.stop();
      await connectDatabase(mongo.getUri());
    }
  });
});
