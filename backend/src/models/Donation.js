import mongoose from 'mongoose';
import { BLOOD_TYPES } from '../config/domain.js';
const schema = new mongoose.Schema({
  donor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  bloodRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'BloodRequest', required: true, immutable: true },
  facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true, immutable: true },
  response: { type: mongoose.Schema.Types.ObjectId, ref: 'DonorResponse', required: true, immutable: true },
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  confirmedAt: { type: Date, required: true, immutable: true },
  units: { type: Number, min: 1, max: 4, required: true, immutable: true, validate: Number.isInteger },
  bloodTypeSnapshot: { type: String, enum: BLOOD_TYPES, required: true, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });
schema.index({ bloodRequest: 1, donor: 1 }, { unique: true });
schema.index({ donor: 1, confirmedAt: -1, _id: -1 });
schema.index({ facility: 1, confirmedAt: -1, _id: -1 });
schema.pre('save', function () { if (!this.isNew) throw new Error('Donations are append-only'); });
for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete']) schema.pre(operation, function () { throw new Error('Donations are append-only'); });
export const Donation = mongoose.model('Donation', schema);
