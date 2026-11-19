import { z } from 'zod';
import { identityShape } from './account.js';
import { phoneKey } from '../utils/phone.js';
const bytes72 = v => Buffer.byteLength(v, 'utf8') <= 72;
// Donor passwords: 8+ characters keeps sign-up realistic for everyone; staff/admin keep 12+.
export const donorPassword = z.string().min(8, 'Use at least 8 characters').max(72).refine(bytes72, 'Password must be at most 72 UTF-8 bytes');
export const phoneInput = identityShape.phone.refine(v => !!phoneKey(v), 'Enter a valid phone number');
export const registerSchema = z.object({
  name: identityShape.name,
  phone: phoneInput,
  password: donorPassword,
  email: identityShape.email.optional(),
  role: z.literal('DONOR').optional(),
}).strict();
export const loginSchema = z.object({
  email: identityShape.email.optional(),
  phone: phoneInput.optional(),
  password: z.string().min(1).max(72).refine(bytes72),
}).strict().refine(v => !!v.email !== !!v.phone, 'Provide either a phone number or an email');
export const otpRequestSchema = z.object({ phone: phoneInput, purpose: z.enum(['SIGN_IN', 'RESET']).default('SIGN_IN') }).strict();
export const otpVerifySchema = z.object({ phone: phoneInput, code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') }).strict();
export const otpCompleteSchema = z.object({ signupToken: z.string().min(20).max(2000), name: identityShape.name }).strict();
export const passwordResetSchema = z.object({ phone: phoneInput, code: z.string().regex(/^\d{6}$/), password: donorPassword }).strict();
