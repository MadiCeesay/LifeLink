import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  phoneKey: { type: String, required: true, maxlength: 20 },
  purpose: { type: String, enum: ['SIGN_IN', 'RESET'], required: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  usedAt: Date,
}, { timestamps: true });
schema.index({ phoneKey: 1, createdAt: -1 });
// Records are kept for an hour (send-rate limiting), but a code is only valid until expiresAt.
schema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });
export const OtpCode = mongoose.model('OtpCode', schema);
