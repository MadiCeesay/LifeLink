import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { setupWorkflow, fixtures, client, createRequest, point } from './helpers/workflow.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { User } from '../src/models/User.js';
import { Facility } from '../src/models/Facility.js';
import { recordAudit } from '../src/services/auditService.js';
let env, f;
beforeAll(async () => { env = await setupWorkflow(); }); beforeEach(async () => { f = await fixtures(); }); afterEach(() => vi.restoreAllMocks()); afterAll(async () => { await env?.close(); });
const call = (actor, method, path, body) => client(env.app, actor, method, path, body);
describe('safe append-oriented audit', () => {
  it('records request creation, broadcasts and cancellation with real actor/facility context', async () => {
    const r = await createRequest(env.app, f.staff); await call(f.staff, 'post', `/requests/${r.id}/broadcast`, { idempotencyKey: randomUUID() });
    await call(f.staff, 'patch', `/requests/${r.id}/cancel`, { reason: 'No longer required' });
    const rows = await AuditLog.find().sort({ timestamp: 1 }); expect(rows.map(x => x.action)).toEqual(['REQUEST_CREATED', 'BROADCAST_INITIATED', 'REQUEST_CANCELLED']);
    expect(rows.every(x => x.actor.equals(f.staff._id) && x.facility.equals(f.facility._id))).toBe(true);
  });
  it('does not record exact facility/donor coordinates or request bodies', async () => {
    await call(f.admin, 'put', `/admin/facilities/${f.facility.id}/location`, point);
    const log = await AuditLog.findOne(); expect(log.action).toBe('FACILITY_LOCATION_CHANGED'); expect(log.metadata).toEqual({});
    const encoded = JSON.stringify(log); for (const field of ['coordinates', 'password', 'JWT_SECRET', 'verificationNotes', '-16.6769']) expect(encoded).not.toContain(field);
  });
  it('rejects unsafe metadata rather than silently retaining it', async () => {
    await expect(recordAudit(null, f.admin._id, 'ACCOUNT_STATUS_CHANGED', 'User', f.donor._id, null, { password: 'secret' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(await AuditLog.countDocuments()).toBe(0);
  });
  it('allows only admin to retrieve bounded filtered audits', async () => {
    await createRequest(env.app, f.staff);
    const res = await call(f.admin, 'get', '/admin/audit-logs?action=REQUEST_CREATED&limit=1'); expect(res.status).toBe(200); expect(res.body.data.pagination.total).toBe(1);
    for (const actor of [f.donor, f.staff]) expect((await call(actor, 'get', '/admin/audit-logs')).status).toBe(403);
    expect((await call(null, 'get', '/admin/audit-logs')).status).toBe(401);
  });
  it('rejects audit update/delete through model and API', async () => {
    await createRequest(env.app, f.staff);
    await expect(AuditLog.updateOne({}, { action: 'REQUEST_CANCELLED' })).rejects.toThrow('append-only');
    await expect(AuditLog.deleteOne({})).rejects.toThrow('append-only');
    const log = await AuditLog.findOne(); expect((await call(f.admin, 'delete', `/admin/audit-logs/${log.id}`)).status).toBe(404);
  });
  it('rolls back a privileged facility mutation when its audit insertion fails', async () => {
    vi.spyOn(AuditLog, 'create').mockRejectedValueOnce(new Error('simulated audit failure'));
    expect((await call(f.admin, 'patch', `/admin/facilities/${f.facility.id}/suspend`, { reason: 'Review required' })).status).toBe(500);
    expect((await Facility.findById(f.facility.id)).verificationStatus).toBe('APPROVED'); expect(await AuditLog.countDocuments()).toBe(0);
  });
  it('validates audit filters and pagination', async () => {
    for (const query of ['limit=101', 'actor=bad', 'action=BAD', 'targetId[$ne]=null', 'page=-1']) expect((await call(f.admin, 'get', '/admin/audit-logs?' + query)).status).toBe(400);
  });
});
describe('controlled account and staff administration', () => {
  it('deactivates/reactivates accounts with a safe shaped response and audit', async () => {
    const path = `/admin/accounts/${f.donor.id}/status`;
    const deactivated = await call(f.admin, 'patch', path, { isActive: false, reasonCode: 'SECURITY_REVIEW' }); expect(deactivated.status).toBe(200);
    expect(deactivated.body.data).toEqual({ id: f.donor.id, role: 'DONOR', isActive: false });
    expect((await call(f.donor, 'get', '/auth/me')).status).toBe(401);
    expect((await call(f.admin, 'patch', path, { isActive: true, reasonCode: 'ACCOUNT_REVIEW' })).status).toBe(200);
    expect((await AuditLog.findOne({ action: 'ACCOUNT_STATUS_CHANGED', 'metadata.isActive': false })).metadata.reasonCode).toBe('SECURITY_REVIEW');
  });
  it('prevents administrator self-lockout and role escalation through account payloads', async () => {
    expect((await call(f.admin, 'patch', `/admin/accounts/${f.admin.id}/status`, { isActive: false, reasonCode: 'ACCOUNT_REVIEW' })).body.error.code).toBe('SELF_DEACTIVATION_DENIED');
    expect((await call(f.admin, 'patch', `/admin/accounts/${f.donor.id}/status`, { isActive: true, reasonCode: 'ACCOUNT_REVIEW', role: 'ADMIN' })).status).toBe(400);
    expect((await call(f.staff, 'patch', `/admin/accounts/${f.donor.id}/status`, { isActive: false, reasonCode: 'ACCOUNT_REVIEW' })).status).toBe(403);
  });
  it('updates explicit staff permissions and enforces the change immediately', async () => {
    const path = `/admin/facilities/${f.facility.id}/staff/${f.staff.id}/permissions`;
    const res = await call(f.admin, 'put', path, { permissions: ['VERIFY_DONORS'] }); expect(res.status).toBe(200);
    expect((await call(f.staff, 'post', '/requests', { patientBloodType: 'O+', unitsNeeded: 1, urgency: 'URGENT', expiresAt: new Date(Date.now() + 3600000).toISOString() })).status).toBe(403);
    expect((await AuditLog.findOne()).action).toBe('STAFF_PERMISSIONS_CHANGED');
    expect((await call(f.admin, 'put', `/admin/facilities/${f.second.id}/staff/${f.staff.id}/permissions`, { permissions: [] })).status).toBe(404);
  });
  it('rejects arbitrary permission names and donor promotion attempts', async () => {
    expect((await call(f.admin, 'put', `/admin/facilities/${f.facility.id}/staff/${f.staff.id}/permissions`, { permissions: ['ADMIN'] })).status).toBe(400);
    expect((await call(f.admin, 'put', `/admin/facilities/${f.facility.id}/staff/${f.donor.id}/permissions`, { permissions: ['CONFIRM_DONATIONS'] })).status).toBe(404);
  });
  it('returns aggregate statistics without contacts or locations', async () => {
    await createRequest(env.app, f.staff);
    const res = await call(f.admin, 'get', '/admin/stats'); expect(res.status).toBe(200); expect(res.body.data).toMatchObject({ donors: 2, verifiedDonors: 1, approvedFacilities: 2, openRequests: 1, confirmedDonations: 0 });
    expect(Object.values(res.body.data).every(x => Number.isInteger(x))).toBe(true);
    expect((await call(f.staff, 'get', '/admin/stats')).status).toBe(403);
  });
  it('account/audit writes rollback together', async () => {
    vi.spyOn(AuditLog, 'create').mockRejectedValueOnce(new Error('simulated audit failure'));
    expect((await call(f.admin, 'patch', `/admin/accounts/${f.donor.id}/status`, { isActive: false, reasonCode: 'ACCOUNT_REVIEW' })).status).toBe(500);
    expect((await User.findById(f.donor.id)).isActive).toBe(true);
  });
});
