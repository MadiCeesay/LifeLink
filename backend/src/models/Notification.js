import mongoose from 'mongoose';
import { NOTIFICATION_CHANNELS, NOTIFICATION_STATUSES } from '../config/domain.js';
const schema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bloodRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'BloodRequest', required: true },
  channel: { type: String, enum: NOTIFICATION_CHANNELS, required: true },
  status: { type: String, enum: NOTIFICATION_STATUSES, default: 'DELIVERED' },
  sentAt: { type: Date, required: true }, readAt: Date,
  radiusKm: { type: Number, required: true, min: 0, max: 500 },
}, { timestamps: true });
schema.index({ bloodRequest: 1, recipient: 1, channel: 1 }, { unique: true });
schema.index({ recipient: 1, createdAt: -1, _id: -1 });
export const Notification = mongoose.model('Notification', schema);
