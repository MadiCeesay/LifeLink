import { z } from 'zod';
import { BLOOD_TYPES } from '../config/domain.js';
import { objectId } from './facility.js';
export const donorParams = z.object({ donorId: objectId }).strict();
export const verificationSchema = z.object({ verifiedBloodType: z.enum(BLOOD_TYPES), notes: z.string().trim().min(1).max(1000).optional() }).strict();
export const verificationStatusSchema = z.object({ status: z.enum(['SUSPENDED', 'REQUIRES_REVERIFICATION']), reason: z.string().trim().min(3).max(1000) }).strict();
