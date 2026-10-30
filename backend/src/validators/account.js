import { z } from 'zod';
export const identityShape = {
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().min(7).max(30).regex(/^\+?[0-9 ()-]+$/).refine(v => {
    const count = v.replace(/\D/g, '').length;
    return count >= 7 && count <= 15;
  }, 'Phone must contain 7 to 15 digits'),
  password: z.string().min(12).max(72).refine(v => Buffer.byteLength(v, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes'),
};
