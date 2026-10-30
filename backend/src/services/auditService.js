import { AuditLog } from '../models/AuditLog.js';
import { User } from '../models/User.js';
import { requireAdmin } from './authorizationService.js';
import { parseInput } from '../utils/parseInput.js';
import { AppError } from '../utils/errors.js';
import { safeAuditMetadataSchema, auditQuerySchema } from '../validators/admin.js';
export async function recordAudit(session, actorId, action, targetType, targetId, facility, metadata = {}) {
  const safe = parseInput(safeAuditMetadataSchema, metadata, 'audit metadata');
  const actor = await User.findOne({ _id: actorId, isActive: true }).select('role').session(session);
  if (!actor) throw new AppError(403, 'FORBIDDEN', 'Audit actor must be active');
  const [log] = await AuditLog.create([{ actor: actorId, actorRole: actor.role, action, targetType, targetId, facility, metadata: safe }], { session });
  return log;
}
export async function listAuditLogs(actorId, input) {
  await requireAdmin(actorId); const { page, limit, actor, action, targetId, facilityId } = parseInput(auditQuerySchema, input);
  const filter = {}; if (actor) filter.actor = actor; if (action) filter.action = action; if (targetId) filter.targetId = targetId; if (facilityId) filter.facility = facilityId;
  const [rows, total] = await Promise.all([AuditLog.find(filter).sort({ timestamp: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), AuditLog.countDocuments(filter)]);
  return { auditLogs: rows.map(l => ({ id: l.id, actor: l.actor.toString(), actorRole: l.actorRole, action: l.action, targetType: l.targetType, targetId: l.targetId.toString(), facilityId: l.facility?.toString(), timestamp: l.timestamp, metadata: l.metadata ?? {} })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
