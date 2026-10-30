import mongoose from 'mongoose';
import { BLOOD_TYPES, VERIFICATION_STATUSES } from '../config/domain.js';
const schema = new mongoose.Schema({
  donor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', immutable: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  previousStatus: { type: String, enum: VERIFICATION_STATUSES, required: true, immutable: true },
  newStatus: { type: String, enum: VERIFICATION_STATUSES, required: true, immutable: true },
  verifiedBloodType: { type: String, enum: BLOOD_TYPES, immutable: true },
  reason: { type: String, maxlength: 1000, immutable: true },
  notes: { type: String, maxlength: 1000, immutable: true },
  sequence: { type: Number, required: true, min: 1, immutable: true },
  timestamp: { type: Date, default: Date.now, immutable: true },
}, { versionKey: false });
schema.index({ donor: 1, sequence: 1 }, { unique: true });
schema.index({ facility: 1, donor: 1, sequence: -1 });
schema.pre('save', function () { if (!this.isNew) throw new Error('Verification events are append-only'); });
for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete']) {
  schema.pre(operation, function () { throw new Error('Verification events are append-only'); });
}
export const VerificationEvent = mongoose.model('VerificationEvent', schema);
