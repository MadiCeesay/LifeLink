import { z } from 'zod';
import { identityShape } from './account.js';
export const registerSchema = z.object({ ...identityShape, role: z.literal('DONOR').optional() }).strict();
export const loginSchema = z.object({ email: identityShape.email, password: z.string().min(1).max(72).refine(v => Buffer.byteLength(v, 'utf8') <= 72) }).strict();
