import mongoose from 'mongoose';
import { BLOOD_TYPES, REQUEST_STATUSES, URGENCIES } from '../config/domain.js';
import { pointSchema } from './geoPoint.js';
const schema = new mongoose.Schema({
  requestingFacility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true, immutable: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  patientBloodType: { type: String, enum: BLOOD_TYPES, required: true, immutable: true },
  unitsNeeded: { type: Number, min: 1, max: 100, required: true, immutable: true, validate: Number.isInteger },
  unitsReceived: { type: Number, default: 0, min: 0, max: 100, validate: Number.isInteger },
  urgency: { type: String, enum: URGENCIES, required: true },
  status: { type: String, enum: REQUEST_STATUSES, default: 'OPEN', required: true },
  requestLocation: { type: pointSchema, required: true, immutable: true },
  expiresAt: { type: Date, required: true, immutable: true },
  fulfilledAt: Date, cancelledAt: Date, cancellationReason: { type: String, maxlength: 1000 },
  broadcastStage: { type: Number, default: -1 },
  broadcastRadiusKm: { type: Number, default: 0 },
  mutationVersion: { type: Number, default: 0, select: false },
}, { timestamps: true });
schema.index({ requestingFacility: 1, createdAt: -1, _id: -1 });
schema.index({ status: 1, expiresAt: 1 });
export const BloodRequest = mongoose.model('BloodRequest', schema);
