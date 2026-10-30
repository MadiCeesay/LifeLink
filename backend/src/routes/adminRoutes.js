import * as administration from '../controllers/adminController.js';
import { accountParams, staffPermissionParams, accountStatusSchema, staffPermissionsSchema, auditQuerySchema } from '../validators/admin.js';
import { adminHistory } from '../controllers/donationController.js';
import { donationQuerySchema } from '../validators/donation.js';
import { geoPointSchema } from '../validators/location.js';
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as facility from '../controllers/facilityController.js';
import * as donor from '../controllers/verificationController.js';
import { facilityParams, facilityCreateSchema, facilityActionSchema, staffSchema, facilitiesQuerySchema, historyQuerySchema } from '../validators/facility.js';
import { donorParams, verificationStatusSchema } from '../validators/verification.js';
export function adminRoutes(config) {
  const router = Router();
  router.use(authenticate(config), authorize('ADMIN'));
  router.patch('/accounts/:userId/status', validate(accountParams, 'params'), validate(accountStatusSchema), administration.account);
  router.put('/facilities/:facilityId/staff/:userId/permissions', validate(staffPermissionParams, 'params'), validate(staffPermissionsSchema), administration.permissions);
  router.get('/stats', administration.stats);
  router.get('/audit-logs', validate(auditQuerySchema, 'query'), administration.audits);
  router.get('/donations', validate(donationQuerySchema, 'query'), adminHistory);
  router.post('/facilities', validate(facilityCreateSchema), facility.create);
  router.get('/facilities', validate(facilitiesQuerySchema, 'query'), facility.list);
  router.get('/facilities/:facilityId', validate(facilityParams, 'params'), facility.get);
  for (const action of ['approve', 'reject', 'suspend', 'reactivate']) {
    router.patch(`/facilities/:facilityId/${action}`, validate(facilityParams, 'params'), validate(facilityActionSchema), facility.transition(action));
  }
  router.put('/facilities/:facilityId/location', validate(facilityParams, 'params'), validate(geoPointSchema), facility.location);
  router.post('/facilities/:facilityId/staff', validate(facilityParams, 'params'), validate(staffSchema), facility.provision);
  router.patch('/donors/:donorId/verification-status', validate(donorParams, 'params'), validate(verificationStatusSchema), donor.changeStatus);
  router.get('/donors/:donorId/verification-history', validate(donorParams, 'params'), validate(historyQuerySchema, 'query'), donor.history);
  return router;
}
