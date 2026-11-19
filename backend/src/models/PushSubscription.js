import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  endpoint: { type: String, required: true, maxlength: 2000 },
  keys: { p256dh: { type: String, required: true, maxlength: 200 }, auth: { type: String, required: true, maxlength: 100 } },
  userAgent: { type: String, maxlength: 300 },
}, { timestamps: true });
schema.index({ endpoint: 1 }, { unique: true });
schema.index({ user: 1 });
export const PushSubscription = mongoose.model('PushSubscription', schema);
