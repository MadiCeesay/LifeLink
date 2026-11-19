import mongoose from 'mongoose';
import { BLOOD_TYPES, VERIFICATION_STATUSES, STAFF_PERMISSIONS, AVAILABILITY_STATUSES } from '../config/domain.js';
import { pointSchema } from './geoPoint.js';
import { phoneKey } from '../utils/phone.js';
export const ROLES = Object.freeze({ DONOR: 'DONOR', FACILITY_USER: 'FACILITY_USER', ADMIN: 'ADMIN' });
const verificationSchema = new mongoose.Schema({
  status: { type: String, enum: VERIFICATION_STATUSES, default: 'UNVERIFIED', required: true },
  verifiedBloodType: { type: String, enum: BLOOD_TYPES },
  verifiedAt: Date,
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedByFacility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility' },
  verificationNotes: { type: String, maxlength: 1000 },
  revision: { type: Number, default: 0, min: 0 },
}, { _id: false });
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  // Email is optional for donors (phone-first sign-up); staff and admins still use one.
  email: { type: String, lowercase: true, trim: true, unique: true, sparse: true, maxlength: 254 },
  phone: { type: String, required: true, maxlength: 30 },
  phoneKey: { type: String, index: true, maxlength: 20 },
  // Optional: donors who sign in with an SMS code may never set a password.
  password: { type: String, select: false },
  role: { type: String, enum: Object.values(ROLES), default: ROLES.DONOR },
  isActive: { type: Boolean, default: true },
  facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', default: null },
  facilityPermissions: { type: [String], enum: STAFF_PERMISSIONS, default: [] },
  donorVerification: { type: verificationSchema, default: function () { return this.role === ROLES.DONOR ? {} : undefined; } },
  availabilityStatus: { type: String, enum: AVAILABILITY_STATUSES, default: 'UNAVAILABLE', required: true },
  locationSharingEnabled: { type: Boolean, default: false, required: true },
  currentLocation: { type: pointSchema, default: undefined, select: false },
  locationUpdatedAt: { type: Date, default: undefined, select: false },
  lastConfirmedDonationAt: { type: Date, default: null, select: false },
  tokenVersion: { type: Number, default: 0, min: 0 },
  authorizationVersion: { type: Number, default: 0, select: false },
}, { timestamps: true, toJSON: { transform(_doc, ret) { delete ret.password; delete ret.phoneKey; delete ret.tokenVersion; delete ret.__v; delete ret.currentLocation; delete ret.locationUpdatedAt; return ret; } } });
schema.pre('validate', function setPhoneKey() { if (this.isModified('phone') || !this.phoneKey) this.phoneKey = phoneKey(this.phone); });
schema.index({ facility: 1, role: 1 });
schema.index({ role: 1, isActive: 1 });
schema.index({ currentLocation: '2dsphere' });
export const User = mongoose.model('User', schema);
export function publicUser(user) {
  return { id: user._id.toString(), name: user.name, email: user.email, phone: user.phone, role: user.role, isActive: user.isActive, createdAt: user.createdAt, updatedAt: user.updatedAt };
}
