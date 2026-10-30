import { z } from 'zod';
import { objectId, paginationShape } from './facility.js';
export const donationSchema = z.object({ donorId: objectId, units: z.number().int().min(1).max(4) }).strict();
export const donationQuerySchema = z.object({ ...paginationShape, facilityId: objectId.optional(), donorId: objectId.optional() }).strict();
