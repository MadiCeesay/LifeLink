import { z } from 'zod';
import { AVAILABILITY_STATUSES } from '../config/domain.js';
export const geoPointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]),
}).strict();
export const availabilitySchema = z.object({ availabilityStatus: z.enum(AVAILABILITY_STATUSES) }).strict();
export const locationSharingSchema = z.object({ locationSharingEnabled: z.boolean() }).strict();
export const clearLocationSchema = z.object({}).strict().default({});
