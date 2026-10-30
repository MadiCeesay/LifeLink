import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createTestDatabase } from './helpers/database.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { initializeDatabase } from '../src/config/initializeDatabase.js';
import { parseEnv } from '../src/config/env.js';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Facility } from '../src/models/Facility.js';
import { VerificationEvent } from '../src/models/VerificationEvent.js';
import { getOwnLocation, setAvailability, setLocationSharing, updateOwnLocation, clearOwnLocation } from '../src/services/locationService.js';
const config = parseEnv({ NODE_ENV: 'test', MONGODB_URI: 'mongodb://127.0.0.1/test', JWT_SECRET: 'phase-three-test-secret-only-at-least-32-characters', CORS_ORIGINS: 'http://localhost:3000', DONOR_LOCATION_MAX_AGE_MINUTES: '60' });
const point = { type: 'Point', coordinates: [-16.6769, 13.4549] };
const prefix = '/api/v1/donors/me';
let mongo, app, hash, donor, other, admin, staff, facility;
const token = user => jwt.sign({}, config.JWT_SECRET, { algorithm: 'HS256', issuer: 'lifelink', audience: 'lifelink-api', subject: user.id, expiresIn: '1h' });
const call = (method, path, user = donor, body) => {
  const req = request(app)[method](path);
  if (user) req.auth(token(user), { type: 'bearer' });
  return body === undefined ? req : req.send(body);
};
const availability = value => call('patch', `${prefix}/availability`, donor, { availabilityStatus: value });
const sharing = value => call('patch', `${prefix}/location-sharing`, donor, { locationSharingEnabled: value });
const update = (body = point) => call('put', `${prefix}/location`, donor, body);
const read = () => call('get', `${prefix}/location`);
const stored = () => User.findById(donor.id).select('+currentLocation +locationUpdatedAt');
async function enableAndLocate() { await sharing(true); return update(); }
async function makeReady() { await availability('AVAILABLE'); return enableAndLocate(); }
beforeAll(async () => {
  mongo = await createTestDatabase();
  await connectDatabase(mongo.getUri());
  await initializeDatabase();
  hash = await bcrypt.hash('test-only-password-123', 12);
  app = createApp(config, { authLimit: 1000, apiLimit: 10000 });
});
beforeEach(async () => {
  await VerificationEvent.collection.deleteMany({});
  await Promise.all([User.deleteMany({}), Facility.deleteMany({})]);
  const base = { name: 'Example Account', phone: '+220 300 1234', password: hash };
  [donor, other, admin] = await User.create([
    { ...base, role: 'DONOR', email: 'donor@example.com' },
    { ...base, role: 'DONOR', email: 'other@example.com' },
    { ...base, role: 'ADMIN', email: 'admin@example.com' },
  ]);
  facility = await Facility.create({ name: 'Example Facility', facilityType: 'HOSPITAL', phone: '+220 300 2222', email: 'facility@example.com', address: 'Example address', createdBy: admin._id, verificationStatus: 'APPROVED' });
  staff = await User.create({ ...base, email: 'staff@example.com', role: 'FACILITY_USER', facility: facility._id, facilityPermissions: ['VERIFY_DONORS'] });
});
afterAll(async () => { await disconnectDatabase(); await mongo?.stop(); });
describe('default state and independent availability/consent', () => {
  it('newly registered donor is unavailable, not sharing, and has no fake location', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({ name: 'New Donor', email: 'new@example.com', phone: '+220 300 5555', password: 'test-only-password-123' });
    expect(reg.status).toBe(201);
    const res = await request(app).get(`${prefix}/location`).auth(reg.body.data.accessToken, { type: 'bearer' });
    expect(res.body.data).toEqual({ availabilityStatus: 'UNAVAILABLE', locationSharingEnabled: false, hasLocation: false, currentLocation: null, locationUpdatedAt: null, isLocationFresh: false, locationReady: false });
    const raw = await User.collection.findOne({ _id: new donor.constructor.base.Types.ObjectId(reg.body.data.user.id) });
    expect(raw.currentLocation).toBeUndefined();
    expect(raw.locationUpdatedAt).toBeUndefined();
  });
  it('donor changes availability without changing consent or inventing a location', async () => {
    const available = await availability('AVAILABLE');
    expect(available.status).toBe(200);
    expect(available.body.data).toMatchObject({ availabilityStatus: 'AVAILABLE', locationSharingEnabled: false, hasLocation: false, locationReady: false });
    expect((await availability('UNAVAILABLE')).body.data.availabilityStatus).toBe('UNAVAILABLE');
  });
  it('enables consent without changing availability or inventing coordinates', async () => {
    const res = await sharing(true);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ availabilityStatus: 'UNAVAILABLE', locationSharingEnabled: true, hasLocation: false, locationReady: false });
  });
  it('unavailability preserves consent and the last location', async () => {
    await makeReady();
    const res = await availability('UNAVAILABLE');
    expect(res.body.data).toMatchObject({ locationSharingEnabled: true, hasLocation: true, isLocationFresh: true, locationReady: false });
  });
  it('available and consented without a location is not ready', async () => {
    await availability('AVAILABLE'); await sharing(true);
    expect((await read()).body.data.locationReady).toBe(false);
  });
  it('unverified donors can configure all location state and become only location-ready', async () => {
    const res = await makeReady();
    expect(res.body.data.locationReady).toBe(true);
    expect((await User.findById(donor.id)).donorVerification.status).toBe('UNVERIFIED');
    expect(res.body.data.matchingEligible).toBeUndefined();
  });
  it.each([null, 'available', 'TEMPORARY', true, 1])('rejects invalid availability: %s', async value => {
    const res = await availability(value); expect(res.status).toBe(400); expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
  it.each(['true', 'false', 1, null])('requires a strict boolean for consent: %s', async value => { expect((await sharing(value)).status).toBe(400); });
  it('disabled consent erases location immediately without changing availability', async () => {
    await makeReady();
    const res = await sharing(false);
    expect(res.body.data).toMatchObject({ availabilityStatus: 'AVAILABLE', locationSharingEnabled: false, currentLocation: null, locationUpdatedAt: null, locationReady: false });
    const raw = await User.collection.findOne({ _id: donor._id });
    expect(raw.currentLocation).toBeUndefined(); expect(raw.locationUpdatedAt).toBeUndefined();
    await sharing(true);
    expect((await read()).body.data.hasLocation).toBe(false);
  });
});
describe('strict location upload and server timestamp', () => {
  it('rejects uploads before consent and does not store coordinates', async () => {
    const res = await update();
    expect(res.status).toBe(409); expect(res.body.error.code).toBe('LOCATION_SHARING_DISABLED');
    expect((await stored()).currentLocation).toBeUndefined();
  });
  it('preserves GeoJSON longitude/latitude order and records server time', async () => {
    await sharing(true);
    const before = Date.now();
    const res = await update();
    const after = Date.now();
    expect(res.status).toBe(200); expect(res.body.data.currentLocation).toEqual(point);
    expect(new Date(res.body.data.locationUpdatedAt).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(res.body.data.locationUpdatedAt).getTime()).toBeLessThanOrEqual(after);
    expect(res.body.data.isLocationFresh).toBe(true);
  });
  it('refreshes the server timestamp and replaces only the latest location', async () => {
    await enableAndLocate();
    await User.updateOne({ _id: donor._id }, { $set: { locationUpdatedAt: new Date(Date.now() - 7200000) } });
    expect((await read()).body.data.isLocationFresh).toBe(false);
    const next = { type: 'Point', coordinates: [-16.6, 13.5] };
    const res = await update(next);
    expect(res.body.data.currentLocation).toEqual(next); expect(res.body.data.isLocationFresh).toBe(true);
  });
  it.each([[-180, -90], [-180, 90], [180, -90], [180, 90], [0, 0]])('accepts explicit valid boundary/zero coordinates %s,%s', async (longitude, latitude) => {
    await sharing(true);
    const res = await update({ type: 'Point', coordinates: [longitude, latitude] });
    expect(res.status).toBe(200); expect(res.body.data.currentLocation.coordinates).toEqual([longitude, latitude]);
  });
  it.each([
    { type: 'Point', coordinates: [-180.001, 0] }, { type: 'Point', coordinates: [180.001, 0] },
    { type: 'Point', coordinates: [0, -90.001] }, { type: 'Point', coordinates: [0, 90.001] },
    { type: 'Point', coordinates: ['-16', 13] }, { type: 'Point', coordinates: [-16, '13'] },
    { type: 'Point', coordinates: [null, 13] }, { type: 'Point', coordinates: [true, 13] },
    { type: 'Point', coordinates: [] }, { type: 'Point', coordinates: [-16] },
    { type: 'Point', coordinates: [-16, 13, 1] }, { type: 'Point', coordinates: { longitude: -16, latitude: 13 } },
    { type: 'LineString', coordinates: [-16, 13] }, { type: 'point', coordinates: [-16, 13] },
    { coordinates: [-16, 13] }, { type: 'Point' }, { longitude: -16, latitude: 13 },
    { currentLocation: point }, { type: 'Point', coordinates: [13, 170] }, {},
  ])('rejects invalid GeoJSON payload %#', async payload => {
    await sharing(true);
    const res = await update(payload);
    expect(res.status).toBe(400); expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect((await stored()).currentLocation).toBeUndefined();
  });
  it.each(['locationUpdatedAt', 'donorId', 'verificationStatus', 'verifiedBloodType', 'facility', 'availabilityStatus', 'locationSharingEnabled', 'isActive', 'role'])('rejects mass assignment via location: %s', async field => {
    await sharing(true);
    expect((await update({ ...point, [field]: 'forged' })).status).toBe(400);
  });
  it('location mutations preserve verification state and account association', async () => {
    const verified = await call('patch', `/api/v1/donors/${donor.id}/verification`, staff, { verifiedBloodType: 'A-' });
    expect(verified.status).toBe(200);
    const before = await User.findById(donor.id);
    await makeReady();
    await availability('UNAVAILABLE'); await sharing(false); await call('delete', `${prefix}/location`);
    const after = await User.findById(donor.id);
    expect(after.donorVerification.toObject()).toEqual(before.donorVerification.toObject());
    expect(after.facility).toBeNull(); expect(after.role).toBe('DONOR');
    expect(await VerificationEvent.countDocuments()).toBe(1);
  });
  it('availability and consent endpoints also reject forged target/verification fields', async () => {
    expect((await call('patch', `${prefix}/availability`, donor, { availabilityStatus: 'AVAILABLE', donorId: other.id })).status).toBe(400);
    expect((await call('patch', `${prefix}/location-sharing`, donor, { locationSharingEnabled: true, donorId: other.id })).status).toBe(400);
    expect((await call('patch', `${prefix}/location-sharing`, donor, { locationSharingEnabled: true, currentLocation: point })).status).toBe(400);
    expect((await stored()).availabilityStatus).toBe('UNAVAILABLE');
  });
});
describe('computed freshness and location clearing', () => {
  it('read model uses configured freshness, not a stored boolean', async () => {
    await makeReady();
    await User.updateOne({ _id: donor._id }, { locationUpdatedAt: new Date(Date.now() - 2 * 60000) });
    const short = createApp({ ...config, DONOR_LOCATION_MAX_AGE_MINUTES: 1 });
    const res = await request(short).get(`${prefix}/location`).auth(token(donor), { type: 'bearer' });
    expect(res.body.data.isLocationFresh).toBe(false); expect(res.body.data.locationReady).toBe(false);
    expect((await read()).body.data.locationReady).toBe(true);
    const raw = await User.collection.findOne({ _id: donor._id });
    expect(raw.isLocationFresh).toBeUndefined(); expect(raw.locationReady).toBeUndefined();
  });
  it('missing timestamps and future timestamps are not fresh', async () => {
    await makeReady();
    await User.updateOne({ _id: donor._id }, { $unset: { locationUpdatedAt: '' } });
    expect((await read()).body.data.isLocationFresh).toBe(false);
    await User.updateOne({ _id: donor._id }, { locationUpdatedAt: new Date(Date.now() + 3600000) });
    expect((await read()).body.data.locationReady).toBe(false);
  });
  it('DELETE erases coordinates/timestamp and revokes consent, preserving availability', async () => {
    await makeReady();
    const res = await call('delete', `${prefix}/location`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ availabilityStatus: 'AVAILABLE', locationSharingEnabled: false, hasLocation: false, currentLocation: null, locationUpdatedAt: null, isLocationFresh: false, locationReady: false });
    const raw = await User.collection.findOne({ _id: donor._id });
    expect(raw.currentLocation).toBeUndefined(); expect(raw.locationUpdatedAt).toBeUndefined();
    expect((await update()).status).toBe(409);
  });
  it('clearing is idempotent and re-enabling consent does not restore old coordinates', async () => {
    await makeReady();
    for (let i = 0; i < 2; i++) expect((await call('delete', `${prefix}/location`)).status).toBe(200);
    await sharing(true);
    expect((await read()).body.data.hasLocation).toBe(false);
    expect((await update()).status).toBe(200);
  });
  it('rejects unexpected fields on DELETE', async () => { expect((await call('delete', `${prefix}/location`, donor, { donorId: other.id })).status).toBe(400); });
});
describe('authorization and privacy boundaries', () => {
  const endpoints = [['get', '/location'], ['put', '/location'], ['delete', '/location'], ['patch', '/availability'], ['patch', '/location-sharing']];
  it.each(endpoints)('requires authentication for %s %s', async (method, path) => {
    expect((await call(method, `${prefix}${path}`, null, {})).status).toBe(401);
  });
  it.each(endpoints)('rejects facility staff on %s %s', async (method, path) => {
    expect((await call(method, `${prefix}${path}`, staff, {})).status).toBe(403);
  });
  it.each(endpoints)('rejects admin on donor-self %s %s', async (method, path) => {
    expect((await call(method, `${prefix}${path}`, admin, {})).status).toBe(403);
  });
  it.each(endpoints)('rejects inactive donor on %s %s', async (method, path) => {
    await User.updateOne({ _id: donor._id }, { isActive: false });
    expect((await call(method, `${prefix}${path}`, donor, {})).status).toBe(401);
  });
  it.each(endpoints)('has no arbitrary-donor %s %s route', async (method, path) => {
    expect((await call(method, `/api/v1/donors/${other.id}${path}`, donor, {})).status).toBe(404);
  });
  it('one donor self-update cannot modify another donor', async () => {
    await makeReady();
    const res = await call('get', `${prefix}/location`, other);
    expect(res.body.data.currentLocation).toBeNull();
    expect((await User.findById(other.id)).availabilityStatus).toBe('UNAVAILABLE');
  });
  it('unrelated endpoints never expose GPS, even to otherwise authorized staff/admin', async () => {
    await makeReady();
    await call('patch', `/api/v1/donors/${donor.id}/verification`, staff, { verifiedBloodType: 'O+' });
    const paths = [
      ['/api/v1/auth/me', donor], [`${prefix}/verification`, donor],
      [`/api/v1/donors/${donor.id}/verification`, staff],
      [`/api/v1/donors/${donor.id}/verification-history`, staff],
      [`/api/v1/admin/donors/${donor.id}/verification-history`, admin],
      ['/api/v1/admin/facilities', admin], ['/api/v1/facilities/me', staff],
    ];
    for (const [path, user] of paths) {
      const res = await call('get', path, user);
      expect(res.status).toBe(200);
      const encoded = JSON.stringify(res.body);
      for (const field of ['currentLocation', 'coordinates', 'locationUpdatedAt', 'password', '-16.6769']) expect(encoded).not.toContain(field);
    }
    const self = await read();
    expect(self.body.data.currentLocation).toEqual(point);
    expect(self.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(self.body)).not.toContain('password');
  });
  it('default database projection and JSON serialization exclude exact location', async () => {
    await enableAndLocate();
    const normal = await User.findById(donor.id);
    expect(normal.currentLocation).toBeUndefined(); expect(normal.locationUpdatedAt).toBeUndefined();
    const selected = await stored();
    expect(selected.currentLocation.coordinates).toEqual(point.coordinates);
    expect(selected.toJSON().currentLocation).toBeUndefined();
    expect(selected.toJSON().locationUpdatedAt).toBeUndefined();
    expect(selected.toJSON().password).toBeUndefined();
  });
  it('does not create nearby/search/admin location APIs', async () => {
    for (const [path, user] of [['/api/v1/donors/nearby', staff], ['/api/v1/admin/donors', admin], [`/api/v1/admin/donors/${donor.id}/location`, admin]]) {
      expect((await call('get', path, user)).status).toBe(404);
    }
  });
  it('enforces self-service authorization when services are used directly', async () => {
    for (const id of [staff.id, admin.id]) {
      await expect(getOwnLocation(id, config)).rejects.toMatchObject({ code: 'DONOR_ACCESS_DENIED' });
      await expect(setAvailability(id, { availabilityStatus: 'AVAILABLE' }, config)).rejects.toMatchObject({ code: 'DONOR_ACCESS_DENIED' });
      await expect(setLocationSharing(id, { locationSharingEnabled: true }, config)).rejects.toMatchObject({ code: 'DONOR_ACCESS_DENIED' });
      await expect(updateOwnLocation(id, point, config)).rejects.toMatchObject({ code: 'DONOR_ACCESS_DENIED' });
      await expect(clearOwnLocation(id, {}, config)).rejects.toMatchObject({ code: 'DONOR_ACCESS_DENIED' });
    }
  });
});
describe('atomic privacy races and database index', () => {
  it('disable sharing versus location update always ends revoked with no coordinates', async () => {
    for (let i = 0; i < 5; i++) {
      await makeReady();
      const tasks = [() => sharing(false), () => update({ type: 'Point', coordinates: [-16.6, 13.5] })];
      const results = await Promise.all((i % 2 ? tasks.reverse() : tasks).map(task => task()));
      expect(results.every(r => [200, 409].includes(r.status))).toBe(true);
      const raw = await User.collection.findOne({ _id: donor._id });
      expect(raw.locationSharingEnabled).toBe(false); expect(raw.currentLocation).toBeUndefined(); expect(raw.locationUpdatedAt).toBeUndefined();
      expect((await read()).body.data.locationReady).toBe(false);
    }
  });
  it('clear versus location update cannot resurrect a revoked location', async () => {
    for (let i = 0; i < 5; i++) {
      await makeReady();
      const tasks = [() => call('delete', `${prefix}/location`), () => update()];
      const results = await Promise.all((i % 2 ? tasks.reverse() : tasks).map(task => task()));
      expect(results.every(r => [200, 409].includes(r.status))).toBe(true);
      const raw = await User.collection.findOne({ _id: donor._id });
      expect(raw.locationSharingEnabled).toBe(false); expect(raw.currentLocation).toBeUndefined(); expect(raw.locationUpdatedAt).toBeUndefined();
    }
  });
  it('clear versus availability preserves both independent user decisions', async () => {
    await enableAndLocate();
    await Promise.all([call('delete', `${prefix}/location`), availability('AVAILABLE')]);
    expect((await read()).body.data).toMatchObject({ availabilityStatus: 'AVAILABLE', locationSharingEnabled: false, hasLocation: false, locationReady: false });
  });
  it('initialization creates the 2dsphere index and unknown locations stay absent', async () => {
    const indexes = await User.collection.indexes();
    expect(indexes.some(index => index.key.currentLocation === '2dsphere')).toBe(true);
    expect((await User.collection.findOne({ _id: donor._id })).currentLocation).toBeUndefined();
    await enableAndLocate();
    expect((await User.collection.findOne({ _id: donor._id })).currentLocation).toEqual(point);
    await call('delete', `${prefix}/location`);
    expect((await User.collection.findOne({ _id: donor._id })).currentLocation).toBeUndefined();
  });
});
