import { describe, it, expect } from 'vitest';
import SwaggerParser from '@apidevtools/swagger-parser';
import request from 'supertest';
import { apiDocumentation } from '../src/config/apiDocumentation.js';
import { createApp } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';
import { authRoutes } from '../src/routes/authRoutes.js';
import { adminRoutes } from '../src/routes/adminRoutes.js';
import { donorRoutes } from '../src/routes/donorRoutes.js';
import { facilityRoutes } from '../src/routes/facilityRoutes.js';
import { requestRoutes } from '../src/routes/requestRoutes.js';
import { notificationRoutes } from '../src/routes/notificationRoutes.js';
import { BLOOD_TYPES, STAFF_PERMISSIONS } from '../src/config/domain.js';
const config = parseEnv({ MONGODB_URI: 'mongodb://127.0.0.1/test', JWT_SECRET: 'documentation-test-only-secret-more-than-32-characters' });
const methods = ['get', 'put', 'post', 'patch', 'delete'];
describe('complete public API documentation', () => {
  it('validates the full OpenAPI specification', async () => { const validated = await SwaggerParser.validate(structuredClone(apiDocumentation)); expect(validated.openapi).toBe('3.0.3'); });
  it('documents every current route and adds no internal matching endpoints', () => {
    const app = createApp(config);
    const operations = new Set();
    for (const layer of app.router.stack.filter(l => l.route)) {
      for (const method of Object.keys(layer.route.methods)) operations.add(method + ' ' + layer.route.path.replace('/api/v1', ''));
    }
    const routers = [['/auth', authRoutes(config, (_req, _res, next) => next())], ['/admin', adminRoutes(config)], ['/facilities', facilityRoutes(config)], ['/donors', donorRoutes(config)], ['/requests', requestRoutes(config)], ['/notifications', notificationRoutes(config)]];
    expect(app.router.stack.filter(l => l.name === 'router')).toHaveLength(routers.length);
    for (const [prefix, router] of routers) for (const layer of router.stack.filter(l => l.route)) {
      const path = (prefix + (layer.route.path === '/' ? '' : layer.route.path)).replace(/:(\w+)/g, '{$1}');
      for (const method of Object.keys(layer.route.methods)) operations.add(method + ' ' + path);
    }
    const documented = new Set(Object.entries(apiDocumentation.paths).flatMap(([path, ops]) => methods.filter(m => ops[m]).map(m => m + ' ' + path)));
    expect(documented).toEqual(operations); expect(documented.size).toBe(43);
    expect([...documented].some(x => /nearby|search-donors|\/matches/.test(x))).toBe(false);
  });
  it('assigns security and explicit role metadata to every operation', () => {
    for (const ops of Object.values(apiDocumentation.paths)) for (const method of methods) {
      const op = ops[method]; if (!op) continue;
      expect(op['x-roles'].length).toBeGreaterThan(0);
      expect(op.security).toEqual(op['x-roles'].includes('PUBLIC') ? [] : [{ bearerAuth: [] }]);
      expect(op.responses['200'] ?? op.responses['201']).toBeDefined();
    }
  });
  it('uses centralized domain enums and has no hash/secret response fields', () => {
    const schemas = apiDocumentation.components.schemas;
    expect(schemas.RequestCreate.properties.patientBloodType.enum).toEqual([...BLOOD_TYPES]);
    expect(schemas.StaffCreate.properties.permissions.items.enum).toEqual([...STAFF_PERMISSIONS]);
    expect(schemas.User.properties.password).toBeUndefined(); expect(schemas.User.properties.tokenVersion).toBeUndefined();
    expect(JSON.stringify(schemas.AuditMetadata)).not.toContain('coordinates');
  });
  it('serves the actual JSON specification without requiring a user session', async () => {
    const res = await request(createApp(config)).get('/api/v1/docs/openapi.json'); expect(res.status).toBe(200); expect(res.body.openapi).toBe('3.0.3'); expect(res.headers['cache-control']).toBe('no-store');
  });
});
