import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import express from 'express';
import { createTestDatabase } from './helpers/database.js';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { parseEnv } from '../src/config/env.js';
import { authorize } from '../src/middleware/auth.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { startServer } from '../src/server.js';
const config = parseEnv({ NODE_ENV: 'test', MONGODB_URI: 'mongodb://127.0.0.1/test', JWT_SECRET: 'a-test-only-secret-with-at-least-32-characters', CORS_ORIGINS: 'http://localhost:3000' });
const input = { name: 'Test Donor', email: 'Donor@Example.com ', phone: '+220 300 1234', password: 'secure-test-password' };
let mongo, app;
beforeAll(async () => {
  // URI comes only from an ephemeral mongod, never from process.env or .env.
  mongo = await createTestDatabase();
  await connectDatabase(mongo.getUri());
  await User.init();
  await User.createIndexes();
  app = createApp(config, { authLimit: 1000, apiLimit: 2000 });
});
beforeEach(async () => { await User.deleteMany({}); });
afterAll(async () => { await disconnectDatabase(); await mongo?.stop(); });
const register = (body = input, target = app) => request(target).post('/api/v1/auth/register').send(body);
describe('identity and authentication', () => {
  it('registers normalized donor, hashes password and never returns it', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ email: 'donor@example.com', role: 'DONOR', isActive: true });
    expect(res.body.data.user.password).toBeUndefined();
    const user = await User.findOne().select('+password');
    expect(user.password).not.toBe(input.password);
    expect(await bcrypt.compare(input.password, user.password)).toBe(true);
    expect(user.toJSON().password).toBeUndefined();
    expect((await User.findOne()).password).toBeUndefined();
  });
  it('protects simultaneous registrations with the database unique index', async () => {
    const results = await Promise.all([register(), register()]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    expect(await User.countDocuments()).toBe(1);
  });
  it('rejects duplicate normalized email', async () => { await register(); expect((await register()).status).toBe(409); });
  it.each([
    { ...input, email: 'invalid' }, { ...input, name: ' ' }, { ...input, password: 'short' },
    { ...input, phone: 'abc' }, { ...input, password: String.fromCodePoint(233).repeat(40) }, { ...input, isActive: false },
    { ...input, role: 'ADMIN' }, { ...input, role: 'FACILITY_USER' },
  ])('rejects invalid input / privilege fields %#', async body => {
    const res = await register(body);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
    expect(await User.countDocuments()).toBe(0);
  });
  it('logs in with normalized email, no password in response', async () => {
    await register();
    const res = await request(app).post('/api/v1/auth/login').send({ email: input.email, password: input.password });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTypeOf('string');
    expect(res.body.data.user.password).toBeUndefined();
  });
  it.each(['wrong-password', 'unknown'])('rejects incorrect credentials: %s', async kind => {
    await register();
    const res = await request(app).post('/api/v1/auth/login').send({ email: kind === 'unknown' ? 'unknown@example.com' : input.email, password: kind === 'unknown' ? input.password : kind });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
  it('rejects invalid login structure', async () => { expect((await request(app).post('/api/v1/auth/login').send({ email: {} })).status).toBe(400); });
  it.each([undefined, 'Bearer invalid', 'Bearer', 'Basic abc'])('rejects missing/malformed token: %s', async header => {
    const req = request(app).get('/api/v1/auth/me');
    if (header) req.set('Authorization', header);
    expect((await req).status).toBe(401);
  });
  it('returns the authenticated user', async () => {
    const registration = await register();
    const res = await request(app).get('/api/v1/auth/me').auth(registration.body.data.accessToken, { type: 'bearer' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('donor@example.com');
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.headers['cache-control']).toBe('no-store');
  });
  it('rejects expired, wrong audience and invalid subject tokens', async () => {
    const reg = await register();
    for (const options of [{ expiresIn: -1 }, { audience: 'other' }, { subject: 'bad' }]) {
      const token = jwt.sign({}, config.JWT_SECRET, { algorithm: 'HS256', subject: reg.body.data.user.id, issuer: 'lifelink', audience: 'lifelink-api', ...options });
      expect((await request(app).get('/api/v1/auth/me').auth(token, { type: 'bearer' })).status).toBe(401);
    }
  });
  it('rejects inactive accounts at login and with a previously issued token', async () => {
    const reg = await register();
    await User.updateOne({}, { isActive: false });
    expect((await request(app).post('/api/v1/auth/login').send({ email: input.email, password: input.password })).status).toBe(401);
    expect((await request(app).get('/api/v1/auth/me').auth(reg.body.data.accessToken, { type: 'bearer' })).status).toBe(401);
  });
});
describe('authorization and HTTP security', () => {
  it.each([[undefined, 401], ['DONOR', 403], ['ADMIN', 200]])('authorizes role %s', async (role, status) => {
    const target = express();
    target.use((req, _res, next) => { if (role) req.user = { role }; next(); });
    target.get('/', authorize('ADMIN'), (_req, res) => res.json({ success: true }));
    target.use(errorHandler);
    expect((await request(target).get('/')).status).toBe(status);
  });
  it('health is ready and headers hide framework', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ok' } });
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
  it('returns consistent 404 and malformed JSON errors', async () => {
    expect((await request(app).get('/missing')).body.error.code).toBe('NOT_FOUND');
    const res = await request(app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
  it('enforces body limits', async () => {
    expect((await register({ ...input, name: 'x'.repeat(20000) })).status).toBe(413);
  });
  it('allows configured origin and rejects unapproved origin', async () => {
    const allowed = await request(app).get('/api/v1/health').set('Origin', 'http://localhost:3000');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect((await request(app).get('/api/v1/health').set('Origin', 'https://unapproved.example')).status).toBe(403);
  });
  it('limits auth attempts with a consistent error', async () => {
    const target = createApp(config, { authLimit: 2 });
    for (let i = 0; i < 2; i++) await request(target).post('/api/v1/auth/login').send({});
    const res = await request(target).post('/api/v1/auth/login').send({});
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
  it('limits general API requests', async () => {
    const target = createApp(config, { apiLimit: 1 });
    await request(target).get('/api/v1/health');
    expect((await request(target).get('/api/v1/health')).status).toBe(429);
  });
  it('hides internal errors', async () => {
    const target = express();
    target.get('/', () => { throw new Error('sensitive mongodb details'); });
    target.use(errorHandler);
    const res = await request(target).get('/');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('sensitive');
    expect(res.body.error.stack).toBeUndefined();
  });
});
describe('configuration and lifecycle', () => {
  it.each([{ JWT_SECRET: 'short' }, { MONGODB_URI: 'bad' }, { PORT: '0' }, { JWT_EXPIRES_IN: '30d' }, { CORS_ORIGINS: '*' }])('rejects unsafe environment %#', overrides => {
    expect(() => parseEnv({ ...config, CORS_ORIGINS: 'http://localhost:3000', ...overrides })).toThrow('Invalid environment configuration');
  });
  it('rejects startup if the required database is unavailable', async () => {
    await disconnectDatabase();
    try { await expect(startServer({ ...config, MONGODB_URI: 'mongodb://127.0.0.1:1/lifelink_test', PORT: 0 })).rejects.toThrow(); }
    finally { await connectDatabase(mongo.getUri()); }
  });
  it('starts the real HTTP server against isolated MongoDB and shuts down', async () => {
    await disconnectDatabase();
    const running = await startServer({ ...config, MONGODB_URI: mongo.getUri(), PORT: 0 });
    try {
      const res = await fetch(`http://127.0.0.1:${running.server.address().port}/api/v1/health`);
      expect(res.status).toBe(200);
    } finally { await running.stop(); }
    expect((await request(app).get('/api/v1/health')).status).toBe(503);
    await connectDatabase(mongo.getUri());
  });
});
