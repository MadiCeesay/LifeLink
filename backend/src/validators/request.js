import { z } from 'zod';
import { BLOOD_TYPES, REQUEST_STATUSES, URGENCIES } from '../config/domain.js';
import { objectId, paginationShape } from './facility.js';
export const requestParams = z.object({ requestId: objectId }).strict();
export const requestCreateSchema = z.object({ patientBloodType: z.enum(BLOOD_TYPES), unitsNeeded: z.number().int().min(1).max(100), urgency: z.enum(URGENCIES), expiresAt: z.union([z.iso.datetime({ offset: true }).transform(v => new Date(v)), z.date()]) }).strict();
export const cancelSchema = z.object({ reason: z.string().trim().min(3).max(1000) }).strict();
export const requestQuerySchema = z.object({ ...paginationShape, status: z.enum(REQUEST_STATUSES).optional(), urgency: z.enum(URGENCIES).optional() }).strict();
