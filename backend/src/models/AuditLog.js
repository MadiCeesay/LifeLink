import mongoose from 'mongoose';
import { AUDIT_ACTIONS } from '../config/domain.js';
import { ROLES } from './User.js';
import { safeAuditMetadataSchema } from '../validators/admin.js';
const schema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  actorRole: { type: String, enum: Object.values(ROLES), required: true, immutable: true },
  action: { type: String, enum: AUDIT_ACTIONS, required: true, immutable: true },
  targetType: { type: String, enum: ['Facility', 'User', 'BloodRequest', 'Donation', 'DonorResponse'], required: true, immutable: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', immutable: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {}, immutable: true, validate: v => safeAuditMetadataSchema.safeParse(v).success },
  timestamp: { type: Date, default: Date.now, immutable: true },
}, { versionKey: false, minimize: false });
schema.index({ timestamp: -1, _id: -1 });
schema.index({ action: 1, timestamp: -1, _id: -1 });
schema.index({ facility: 1, timestamp: -1, _id: -1 });
schema.pre('save', function () { if (!this.isNew) throw new Error('Audit logs are append-only'); });
for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete']) schema.pre(operation, function () { throw new Error('Audit logs are append-only'); });
export const AuditLog = mongoose.model('AuditLog', schema);
