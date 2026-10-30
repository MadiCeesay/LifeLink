import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createTestDatabase } from './helpers/database.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { initializeDatabase } from '../src/config/initializeDatabase.js';
import { parseEnv } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Facility } from '../src/models/Facility.js';
import { VerificationEvent } from '../src/models/VerificationEvent.js';
import { createMatchingService } from '../src/services/matchingService.js';
import { buildCandidatePipeline } from '../src/services/matchingQuery.js';
import { setLocationSharing, setAvailability } from '../src/services/locationService.js';
import { changeVerificationStatus } from '../src/services/verificationService.js';
import { createApp } from '../src/app.js';
const config = parseEnv({ NODE_ENV: 'test', MONGODB_URI: 'mongodb://127.0.0.1/test', JWT_SECRET: 'phase-four-test-secret-at-least-32-characters', CORS_ORIGINS: 'http://localhost:3000' });
const now = new Date('2026-10-30T12:00:00.000Z');
const origin = { type: 'Point', coordinates: [-16.6769, 13.4549] };
const pointAt = longitude => ({ type: 'Point', coordinates: [longitude, origin.coordinates[1]] });
const input = { recipientBloodType: 'O+', requestLocation: origin, radiusKm: 5, now };
const progressiveInput = { recipientBloodType: 'O+', requestLocation: origin, desiredCandidates: 2, now };
let mongo, hash, donor, admin, staff, facility, engine, app, sequence;
async function createDonor(patch = {}) {
  return User.create({ name: 'Candidate Donor', email: `candidate${sequence++}@example.com`, phone: '+220 300 1234', password: hash,
    role: 'DONOR', isActive: true, availabilityStatus: 'AVAILABLE', locationSharingEnabled: true,
    currentLocation: pointAt(-16.6669), locationUpdatedAt: now,
    donorVerification: { status: 'VERIFIED', verifiedBloodType: 'O-', verifiedAt: now, verifiedBy: staff._id, verifiedByFacility: facility._id, verificationNotes: 'Internal private note' },
    ...patch,
  });
}
async function search(patch = {}) { return engine.findCandidates({ ...input, ...patch }); }
const token = user => jwt.sign({}, config.JWT_SECRET, { algorithm: 'HS256', issuer: 'lifelink', audience: 'lifelink-api', subject: user.id, expiresIn: '1h' });
beforeAll(async () => {
  mongo = await createTestDatabase();
  await connectDatabase(mongo.getUri()); await initializeDatabase();
  hash = await bcrypt.hash('test-only-password-123', 12);
  engine = createMatchingService(config);
  app = createApp(config, { authLimit: 1000, apiLimit: 10000 });
});
beforeEach(async () => {
  await VerificationEvent.collection.deleteMany({});
  await Promise.all([User.deleteMany({}), Facility.deleteMany({})]);
  sequence = 0;
  admin = await User.create({ name: 'Example Admin', email: 'admin@example.com', phone: '+220 300 1111', password: hash, role: 'ADMIN' });
  facility = await Facility.create({ name: 'Example Facility', facilityType: 'HOSPITAL', email: 'facility@example.com', phone: '+220 300 2222', address: 'Example address', createdBy: admin._id, verificationStatus: 'APPROVED' });
  staff = await User.create({ name: 'Example Staff', email: 'staff@example.com', phone: '+220 300 3333', password: hash, role: 'FACILITY_USER', facility: facility._id, facilityPermissions: ['VERIFY_DONORS'] });
  donor = await createDonor();
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { await disconnectDatabase(); await mongo?.stop(); });
describe('full database candidate eligibility', () => {
  it('includes verified, compatible, active and location-ready donors', async () => {
    const res = await search();
    expect(res.candidateCount).toBe(1); expect(res.radiusUsedKm).toBe(5);
    expect(res.candidates[0]).toMatchObject({ donorId: donor.id, verifiedBloodType: 'O-' });
  });
  it.each([
    ['inactive', { isActive: false }], ['admin role', { role: 'ADMIN' }], ['facility role', { role: 'FACILITY_USER' }],
    ['unverified', { 'donorVerification.status': 'UNVERIFIED' }],
    ['verification suspended', { 'donorVerification.status': 'SUSPENDED' }],
    ['requires reverification', { 'donorVerification.status': 'REQUIRES_REVERIFICATION' }],
    ['incompatible verified group', { 'donorVerification.verifiedBloodType': 'A+' }],
    ['unavailable', { availabilityStatus: 'UNAVAILABLE' }], ['no consent', { locationSharingEnabled: false }],
    ['stale location', { locationUpdatedAt: new Date(now.getTime() - 3600001) }],
    ['future location', { locationUpdatedAt: new Date(now.getTime() + 1) }],
    ['outside requested radius', { currentLocation: pointAt(-16.5769) }],
  ])('excludes %s independently', async (_reason, patch) => {
    await User.updateOne({ _id: donor._id }, { $set: patch });
    expect((await search()).candidates).toEqual([]);
  });
  it.each(['donorVerification.verifiedBloodType', 'donorVerification', 'currentLocation', 'locationUpdatedAt', 'locationSharingEnabled', 'availabilityStatus'])('excludes missing %s', async field => {
    await User.collection.updateOne({ _id: donor._id }, { $unset: { [field]: '' } });
    expect((await search()).candidateCount).toBe(0);
  });
  it.each([
    { locationUpdatedAt: null }, { locationUpdatedAt: '2026-10-30T12:00:00Z' }, { locationUpdatedAt: [now] },
    { 'donorVerification.verifiedBloodType': ['O-'] }, { 'donorVerification.status': ['VERIFIED'] },
    { role: ['DONOR'] }, { isActive: [true] }, { availabilityStatus: ['AVAILABLE'] }, { locationSharingEnabled: [true] },
  ])('rejects malformed raw eligibility state %#', async patch => {
    await User.collection.updateOne({ _id: donor._id }, { $set: patch });
    expect((await search()).candidateCount).toBe(0);
  });
  it.each([[0, 1], [3600000, 1], [3600001, 0], [-1, 0]])('enforces inclusive freshness boundary at age %d', async (age, count) => {
    await User.updateOne({ _id: donor._id }, { locationUpdatedAt: new Date(now.getTime() - age) });
    expect((await search()).candidateCount).toBe(count);
  });
  it('uses the configured freshness cutoff', async () => {
    await User.updateOne({ _id: donor._id }, { locationUpdatedAt: new Date(now.getTime() - 120000) });
    const short = createMatchingService({ ...config, DONOR_LOCATION_MAX_AGE_MINUTES: 1 });
    expect((await short.findCandidates(input)).candidateCount).toBe(0);
    expect((await search()).candidateCount).toBe(1);
  });
  it('uses verified blood type and does not infer trust from an unverified location-ready account', async () => {
    await User.updateOne({ _id: donor._id }, { 'donorVerification.status': 'UNVERIFIED' });
    expect((await search()).candidateCount).toBe(0);
    await User.updateOne({ _id: donor._id }, { 'donorVerification.status': 'VERIFIED', 'donorVerification.verifiedBloodType': 'A+' });
    expect((await search()).candidateCount).toBe(0);
  });
  it('combines all predicates while returning only fully eligible donors', async () => {
    await createDonor({ isActive: false, availabilityStatus: 'UNAVAILABLE', donorVerification: { status: 'UNVERIFIED' } });
    await createDonor({ locationSharingEnabled: false, locationUpdatedAt: new Date(now.getTime() - 7200000) });
    await createDonor({ donorVerification: { status: 'VERIFIED', verifiedBloodType: 'B+' } });
    expect((await search()).candidates.map(c => c.donorId)).toEqual([donor.id]);
  });
  it('supports non-identical compatible verified groups using the centralized policy', async () => {
    const a = await createDonor({ donorVerification: { status: 'VERIFIED', verifiedBloodType: 'A-' } });
    const res = await search({ recipientBloodType: 'A+' });
    expect(new Set(res.candidates.map(c => c.donorId))).toEqual(new Set([donor.id, a.id]));
    expect((await search({ recipientBloodType: 'O-' })).candidates.map(c => c.donorId)).toEqual([donor.id]);
  });
});
describe('real indexed geospatial behavior', () => {
  it('uses meters and puts the nearest donor before farther donors', async () => {
    const farther = await createDonor({ currentLocation: pointAt(-16.6269) });
    const res = await search({ radiusKm: 10 });
    expect(res.candidates.map(c => c.donorId)).toEqual([donor.id, farther.id]);
    expect(res.candidates[0].distanceMeters).toBeGreaterThan(1000);
    expect(res.candidates[0].distanceMeters).toBeLessThan(1200);
    expect(res.candidates[1].distanceMeters).toBeGreaterThan(5000);
  });
  it('accepts deliberate zero coordinates and measures known equatorial distances', async () => {
    await User.updateOne({ _id: donor._id }, { currentLocation: { type: 'Point', coordinates: [0.01, 0] } });
    const res = await search({ requestLocation: { type: 'Point', coordinates: [0, 0] }, radiusKm: 2 });
    expect(res.candidateCount).toBe(1);
    expect(res.candidates[0].distanceMeters).toBeCloseTo(1113.2, 0);
  });
  it('excludes a donor just outside the radius and includes just inside it', async () => {
    const { distanceMeters } = (await search()).candidates[0];
    expect((await search({ radiusKm: (distanceMeters + 0.01) / 1000 })).candidateCount).toBe(1);
    expect((await search({ radiusKm: (distanceMeters - 0.01) / 1000 })).candidateCount).toBe(0);
  });
  it('includes the measured maximum-distance boundary', async () => {
    const { distanceMeters } = (await search()).candidates[0];
    expect((await search({ radiusKm: distanceMeters / 1000 })).candidateCount).toBe(1);
  });
  it('does not silently swap longitude and latitude', async () => {
    const reversed = { type: 'Point', coordinates: [...origin.coordinates].reverse() };
    expect((await search({ requestLocation: reversed })).candidateCount).toBe(0);
    expect((await search()).candidateCount).toBe(1);
  });
  it('orders exact distance ties by donor ID deterministically', async () => {
    await User.deleteOne({ _id: donor._id });
    const ids = ['000000000000000000000002', '000000000000000000000001'];
    for (const id of ids) await createDonor({ _id: new mongoose.Types.ObjectId(id) });
    expect((await search()).candidates.map(c => c.donorId)).toEqual([...ids].sort());
  });
  it('applies hard result limits and a bounded default', async () => {
    for (let i = 0; i < 25; i++) await createDonor({ currentLocation: pointAt(-16.6768 + i * 0.0001) });
    expect((await search({ limit: 3 })).candidates).toHaveLength(3);
    expect((await search()).candidates).toHaveLength(20);
  });
  it('limits even dense candidate pools to the maximum 100 results', async () => {
    const docs = Array.from({ length: 110 }, (_, i) => ({ name: 'Dense Pool', email: `dense${i}@example.com`, phone: '+220 300 1234', password: hash,
      role: 'DONOR', isActive: true, availabilityStatus: 'AVAILABLE', locationSharingEnabled: true,
      donorVerification: { status: 'VERIFIED', verifiedBloodType: 'O-' }, currentLocation: pointAt(-16.6768 + i * 0.0001), locationUpdatedAt: now }));
    await User.insertMany(docs);
    const res = await search({ limit: 100 });
    expect(res.candidateCount).toBe(100); expect(new Set(res.candidates.map(c => c.donorId)).size).toBe(100);
    expect(res.candidates.map(c => c.distanceMeters)).toEqual(res.candidates.map(c => c.distanceMeters).sort((a, b) => a - b));
  });
  it('uses the existing 2dsphere index in the real query plan', async () => {
    const indexes = await User.collection.indexes();
    expect(indexes.some(i => i.key.currentLocation === '2dsphere')).toBe(true);
    const explain = await User.aggregate(buildCandidatePipeline({ ...input, limit: 20 }, 60)).explain('executionStats');
    const plan = JSON.stringify(explain);
    expect(plan).toContain('GEO_NEAR_2DSPHERE');
    expect(plan).toContain('currentLocation_2dsphere');
  });
});
describe('bounded progressive search and unique cumulative results', () => {
  it('stops at the first stage when the target is met', async () => {
    const spy = vi.spyOn(User, 'aggregate');
    const res = await engine.findCandidatesProgressively({ ...progressiveInput, desiredCandidates: 1 });
    expect(res.radiusUsedKm).toBe(5); expect(res.targetReached).toBe(true);
    expect(res.stagesSearched).toEqual([{ radiusKm: 5, candidateCount: 1 }]);
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it('expands to the second stage and stops when enough candidates exist', async () => {
    const farther = await createDonor({ currentLocation: pointAt(-16.6269) });
    await createDonor({ currentLocation: pointAt(-16.5769) });
    const spy = vi.spyOn(User, 'aggregate');
    const res = await engine.findCandidatesProgressively(progressiveInput);
    expect(res.stagesSearched).toEqual([{ radiusKm: 5, candidateCount: 1 }, { radiusKm: 10, candidateCount: 2 }]);
    expect(res.radiusUsedKm).toBe(10); expect(res.targetReached).toBe(true);
    expect(res.candidates.map(c => c.donorId)).toEqual([donor.id, farther.id]);
    expect(spy).toHaveBeenCalledTimes(2);
  });
  it('searches all stages if needed, retains nearest order and never duplicates IDs', async () => {
    await createDonor({ currentLocation: pointAt(-16.6269) });
    await createDonor({ currentLocation: pointAt(-16.5769) });
    const res = await engine.findCandidatesProgressively({ ...progressiveInput, desiredCandidates: 10 });
    expect(res.stagesSearched.map(s => s.radiusKm)).toEqual([5, 10, 20, 40]);
    expect(res.stagesSearched.map(s => s.candidateCount)).toEqual([1, 2, 3, 3]);
    expect(res.targetReached).toBe(false); expect(res.candidateCount).toBe(3);
    expect(new Set(res.candidates.map(c => c.donorId)).size).toBe(3);
    expect(res.candidates.filter(c => c.donorId === donor.id)).toHaveLength(1);
    expect(res.candidates.map(c => c.distanceMeters)).toEqual(res.candidates.map(c => c.distanceMeters).sort((a, b) => a - b));
  });
  it('honors custom validated radius stages', async () => {
    const custom = createMatchingService({ ...config, MATCH_RADIUS_STAGES_KM: [0.5, 1, 2] });
    const res = await custom.findCandidatesProgressively({ ...progressiveInput, desiredCandidates: 1 });
    expect(res.stagesSearched).toEqual([{ radiusKm: 0.5, candidateCount: 0 }, { radiusKm: 1, candidateCount: 0 }, { radiusKm: 2, candidateCount: 1 }]);
    expect(res.radiusUsedKm).toBe(2);
  });
  it('returns an empty bounded result after exhausting radii', async () => {
    await User.updateOne({ _id: donor._id }, { availabilityStatus: 'UNAVAILABLE' });
    const res = await engine.findCandidatesProgressively(progressiveInput);
    expect(res.candidates).toEqual([]); expect(res.radiusUsedKm).toBe(40); expect(res.targetReached).toBe(false);
    expect(res.stagesSearched).toHaveLength(4);
  });
  it('returns no more than the desired target even when a stage has more donors', async () => {
    await createDonor(); await createDonor(); await createDonor();
    const res = await engine.findCandidatesProgressively(progressiveInput);
    expect(res.candidates).toHaveLength(2); expect(res.candidateCount).toBe(2); expect(res.stagesSearched).toHaveLength(1);
  });
  it('rechecks later stages instead of retaining a donor who revoked consent', async () => {
    const farther = await createDonor({ currentLocation: pointAt(-16.6269) });
    const aggregate = User.aggregate.bind(User);
    let calls = 0;
    vi.spyOn(User, 'aggregate').mockImplementation(async pipeline => {
      const result = await aggregate(pipeline);
      if (++calls === 1) await setLocationSharing(donor._id, { locationSharingEnabled: false }, config);
      return result;
    });
    const res = await engine.findCandidatesProgressively(progressiveInput);
    expect(res.candidates.map(c => c.donorId)).toEqual([farther.id]);
    expect(res.targetReached).toBe(false); expect(calls).toBe(4);
  });
});
describe('live state, time, minimized results and absent HTTP search', () => {
  it.each(['consent', 'availability', 'verification', 'account'])('subsequent search observes a change to %s', async field => {
    expect((await search()).candidateCount).toBe(1);
    if (field === 'consent') await setLocationSharing(donor._id, { locationSharingEnabled: false }, config);
    if (field === 'availability') await setAvailability(donor._id, { availabilityStatus: 'UNAVAILABLE' }, config);
    if (field === 'verification') await changeVerificationStatus(admin._id, donor.id, { status: 'SUSPENDED', reason: 'Administrative review required' });
    if (field === 'account') await User.updateOne({ _id: donor._id }, { isActive: false });
    expect((await search()).candidateCount).toBe(0);
  });
  it('uses a new server clock value for each invocation rather than cached eligibility', async () => {
    let time = new Date(now);
    const clocked = createMatchingService(config, { clock: () => time });
    const params = { recipientBloodType: 'O+', requestLocation: origin, radiusKm: 5 };
    expect((await clocked.findCandidates(params)).candidateCount).toBe(1);
    time = new Date(now.getTime() + 3600001);
    expect((await clocked.findCandidates(params)).candidateCount).toBe(0);
  });
  it('returns exactly three candidate fields without contact, GPS or internal metadata', async () => {
    for (const res of [await search(), await engine.findCandidatesProgressively(progressiveInput)]) {
      expect(res.candidateCount).toBe(1);
      expect(Object.keys(res.candidates[0]).sort()).toEqual(['distanceMeters', 'donorId', 'verifiedBloodType']);
      const json = JSON.stringify(res);
      for (const field of ['currentLocation', 'coordinates', 'locationUpdatedAt', 'password', 'email', 'phone', 'verificationNotes', 'facility', 'Internal private note']) expect(json).not.toContain(field);
    }
  });
  it.each(['unauthenticated', 'DONOR', 'FACILITY_USER', 'ADMIN'])('does not expose arbitrary search to %s', async role => {
    const paths = [
      ['get', '/api/v1/donors/nearby?lng=-16.6769&lat=13.4549'],
      ['get', '/api/v1/matches'], ['post', '/api/v1/search-donors'],
      ['post', '/api/v1/donors/search'], ['get', '/api/v1/admin/matches'],
      ['post', '/api/v1/facilities/me/matches'],
    ];
    for (const [method, path] of paths) {
      const req = request(app)[method](path);
      if (role !== 'unauthenticated') req.auth(token(role === 'DONOR' ? donor : role === 'ADMIN' ? admin : staff), { type: 'bearer' });
      const res = await req;
      let expectedStatus = 404;
      if (path.startsWith('/api/v1/admin/') && role !== 'ADMIN') expectedStatus = role === 'unauthenticated' ? 401 : 403;
      else if (role === 'unauthenticated' && path.startsWith('/api/v1/donors/')) expectedStatus = 401;
      expect(res.status).toBe(expectedStatus);
      expect(res.body.success).toBe(false);
    }
  });
  it('keeps existing auth/verification/history/facility endpoints free of donor GPS and hashes', async () => {
    await VerificationEvent.create({ donor: donor._id, facility: facility._id, performedBy: staff._id, previousStatus: 'UNVERIFIED', newStatus: 'VERIFIED', verifiedBloodType: 'O-', sequence: 1 });
    const paths = [
      ['/api/v1/auth/me', donor], ['/api/v1/donors/me/verification', donor],
      [`/api/v1/donors/${donor.id}/verification`, staff], [`/api/v1/donors/${donor.id}/verification-history`, staff],
      [`/api/v1/admin/donors/${donor.id}/verification-history`, admin],
      ['/api/v1/admin/facilities', admin], ['/api/v1/facilities/me', staff],
    ];
    for (const [path, user] of paths) {
      const res = await request(app).get(path).auth(token(user), { type: 'bearer' });
      expect(res.status).toBe(200);
      for (const field of ['currentLocation', 'coordinates', 'locationUpdatedAt', 'password']) expect(JSON.stringify(res.body)).not.toContain(field);
    }
    const raw = await User.collection.findOne({ _id: donor._id });
    expect(raw.isMatchEligible).toBeUndefined();
  });
});
