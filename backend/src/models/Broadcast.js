import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  bloodRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'BloodRequest', required: true },
  idempotencyKey: { type: String, required: true, maxlength: 80 },
  initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  radiusUsedKm: { type: Number, required: true },
  candidateCount: { type: Number, required: true },
  notifiedCount: { type: Number, required: true },
}, { timestamps: true });
schema.index({ bloodRequest: 1, idempotencyKey: 1 }, { unique: true });
export const Broadcast = mongoose.model('Broadcast', schema);
