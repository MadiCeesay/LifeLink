import mongoose from 'mongoose';
import { DONOR_RESPONSE_STATUSES } from '../config/domain.js';
const schema = new mongoose.Schema({
  donor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bloodRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'BloodRequest', required: true },
  notification: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification', required: true },
  status: { type: String, enum: DONOR_RESPONSE_STATUSES, required: true },
  respondedAt: { type: Date, default: Date.now },
}, { timestamps: true });
schema.index({ bloodRequest: 1, donor: 1 }, { unique: true });
schema.index({ bloodRequest: 1, respondedAt: -1, _id: -1 });
export const DonorResponse = mongoose.model('DonorResponse', schema);
