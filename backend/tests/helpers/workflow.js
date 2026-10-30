import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createTestDatabase } from './database.js';
import { connectDatabase, disconnectDatabase } from '../../src/config/database.js';
import { initializeDatabase } from '../../src/config/initializeDatabase.js';
import { parseEnv } from '../../src/config/env.js';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Facility } from '../../src/models/Facility.js';
import { STAFF_PERMISSIONS } from '../../src/config/domain.js';
export const config = parseEnv({ NODE_ENV: 'test', MONGODB_URI: 'mongodb://127.0.0.1/test', JWT_SECRET: 'workflow-test-only-secret-more-than-32-characters', CORS_ORIGINS: 'http://localhost:3000' });
export const point = { type: 'Point', coordinates: [-16.6769, 13.4549] };
let hash;
export async function setupWorkflow() {
  const mongo = await createTestDatabase(); await connectDatabase(mongo.getUri()); await initializeDatabase();
  hash = await bcrypt.hash('test-only-password-123', 12);
  return { mongo, app: createApp(config, { authLimit: 1000, apiLimit: 10000 }), close: async () => { await disconnectDatabase(); await mongo.stop(); } };
}
export function token(user) { return jwt.sign({}, config.JWT_SECRET, { algorithm: 'HS256', issuer: 'lifelink', audience: 'lifelink-api', subject: user.id, expiresIn: '1h' }); }
export function client(app, user, method, path, body) {
  const req = request(app)[method]('/api/v1' + path);
  if (user) req.auth(token(user), { type: 'bearer' });
  return body === undefined ? req : req.send(body);
}
export async function fixtures() {
  for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
  const base = { name: 'Example Account', phone: '+220 300 1234', password: hash };
  const admin = await User.create({ ...base, email: 'admin@example.com', role: 'ADMIN' });
  const facility = await Facility.create({ name: 'Example Facility', email: 'facility@example.com', phone: '+220 300 2222', facilityType: 'HOSPITAL', address: 'Example address', createdBy: admin._id, verificationStatus: 'APPROVED', location: point });
  const second = await Facility.create({ name: 'Second Facility', email: 'second@example.com', phone: '+220 300 3333', facilityType: 'CLINIC', address: 'Second address', createdBy: admin._id, verificationStatus: 'APPROVED', location: point });
  const staff = await User.create({ ...base, email: 'staff@example.com', role: 'FACILITY_USER', facility: facility._id, facilityPermissions: [...STAFF_PERMISSIONS] });
  const otherStaff = await User.create({ ...base, email: 'otherstaff@example.com', role: 'FACILITY_USER', facility: second._id, facilityPermissions: [...STAFF_PERMISSIONS] });
  const donor = await User.create({ ...base, email: 'donor@example.com', role: 'DONOR', donorVerification: { status: 'VERIFIED', verifiedBloodType: 'O-', verifiedBy: staff._id, verifiedByFacility: facility._id, verifiedAt: new Date() }, availabilityStatus: 'AVAILABLE', locationSharingEnabled: true, currentLocation: { type: 'Point', coordinates: [-16.6669, 13.4549] }, locationUpdatedAt: new Date() });
  const otherDonor = await User.create({ ...base, email: 'otherdonor@example.com', role: 'DONOR' });
  return { admin, facility, second, staff, otherStaff, donor, otherDonor };
}
export function requestInput(patch = {}) { return { patientBloodType: 'O+', unitsNeeded: 2, urgency: 'CRITICAL', expiresAt: new Date(Date.now() + 3600000).toISOString(), ...patch }; }
export async function createRequest(app, staff, patch = {}) { const res = await client(app, staff, 'post', '/requests', requestInput(patch)); if (res.status !== 201) throw new Error(JSON.stringify(res.body)); return res.body.data; }
