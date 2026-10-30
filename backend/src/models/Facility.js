import mongoose from 'mongoose';
import { pointSchema } from './geoPoint.js';
import { FACILITY_TYPES, FACILITY_STATUSES } from '../config/domain.js';
const transition = new mongoose.Schema({
  previousStatus: { type: String, enum: FACILITY_STATUSES, required: true },
  newStatus: { type: String, enum: FACILITY_STATUSES, required: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true, maxlength: 1000 },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  facilityType: { type: String, enum: FACILITY_TYPES, required: true },
  referenceNumber: { type: String, trim: true, maxlength: 100 },
  phone: { type: String, required: true, maxlength: 30 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  address: { type: String, required: true, maxlength: 500 },
  verificationStatus: { type: String, enum: FACILITY_STATUSES, default: 'PENDING', required: true },
  isActive: { type: Boolean, default: true },
  location: { type: pointSchema, default: undefined },
  locationUpdatedAt: Date,
  locationUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedAt: Date,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: { type: String, maxlength: 1000 },
  statusHistory: { type: [transition], default: [] },
  authorizationVersion: { type: Number, default: 0, select: false },
}, { timestamps: true });
schema.index({ verificationStatus: 1, createdAt: -1, _id: -1 });
export const Facility = mongoose.model('Facility', schema);
