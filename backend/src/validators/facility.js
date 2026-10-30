import { z } from 'zod';
import { FACILITY_TYPES, FACILITY_STATUSES, STAFF_PERMISSIONS } from '../config/domain.js';
import { identityShape } from './account.js';
export const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid MongoDB identifier');
export const facilityParams = z.object({ facilityId: objectId }).strict();
export const facilityCreateSchema = z.object({
  name: identityShape.name, facilityType: z.enum(FACILITY_TYPES),
  referenceNumber: z.string().trim().min(1).max(100).optional(),
  phone: identityShape.phone, email: identityShape.email,
  address: z.string().trim().min(3).max(500),
}).strict();
export const facilityActionSchema = z.object({ reason: z.string().trim().min(3).max(1000) }).strict();
export const staffSchema = z.object({ ...identityShape, permissions: z.array(z.enum(STAFF_PERMISSIONS)).max(STAFF_PERMISSIONS.length).default(['VERIFY_DONORS']).refine(v => new Set(v).size === v.length, 'Duplicate permissions') }).strict();
export const paginationShape = { page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) };
export const facilitiesQuerySchema = z.object({ ...paginationShape, status: z.enum(FACILITY_STATUSES).optional() }).strict();
export const historyQuerySchema = z.object(paginationShape).strict();
