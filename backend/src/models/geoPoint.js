import mongoose from 'mongoose';
import { geoPointSchema } from '../validators/location.js';
export const pointSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], required: true },
  coordinates: { type: [Number], required: true, default: undefined, validate: { validator: coordinates => geoPointSchema.safeParse({ type: 'Point', coordinates }).success, message: 'Coordinates must be valid [longitude, latitude]' } },
}, { _id: false });
