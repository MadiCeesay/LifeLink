import { z } from 'zod';
import { DONOR_RESPONSE_STATUSES } from '../config/domain.js';
import { objectId, paginationShape } from './facility.js';
import { geoPointSchema } from './location.js';
export const notificationParams = z.object({ notificationId: objectId }).strict();
export const broadcastSchema = z.object({ idempotencyKey: z.string().uuid(), expand: z.boolean().default(false), desiredCandidates: z.number().int().min(1).max(100).default(20) }).strict();
export const notificationQuerySchema = z.object({ ...paginationShape, unread: z.enum(['true', 'false']).optional() }).strict();
export const responseSchema = z.object({ status: z.enum(DONOR_RESPONSE_STATUSES), location: geoPointSchema.optional() }).strict().refine(v => !v.location || v.status === 'ACCEPTED', 'Only acceptance may submit fresh location');
