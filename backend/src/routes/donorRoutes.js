import { own as ownDonations } from '../controllers/donationController.js';
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { approvedFacility } from '../middleware/facility.js';
import { validate } from '../middleware/validate.js';
import { donorParams, verificationSchema } from '../validators/verification.js';
import { historyQuerySchema } from '../validators/facility.js';
import { createLocationController } from '../controllers/locationController.js';
import { availabilitySchema, locationSharingSchema, geoPointSchema, clearLocationSchema } from '../validators/location.js';
import * as controller from '../controllers/verificationController.js';
export function donorRoutes(config) {
  const router = Router();
  router.use(authenticate(config));
  const location = createLocationController(config);
  router.get('/me/location', authorize('DONOR'), location.get);
  router.put('/me/location', authorize('DONOR'), validate(geoPointSchema), location.update);
  router.delete('/me/location', authorize('DONOR'), validate(clearLocationSchema), location.clear);
  router.patch('/me/availability', authorize('DONOR'), validate(availabilitySchema), location.availability);
  router.patch('/me/location-sharing', authorize('DONOR'), validate(locationSharingSchema), location.sharing);
  router.get('/me/donations', authorize('DONOR'), validate(historyQuerySchema, 'query'), ownDonations);
  router.get('/me/verification', authorize('DONOR'), controller.own);
  router.get('/:donorId/verification', authorize('FACILITY_USER'), approvedFacility, validate(donorParams, 'params'), controller.lookup);
  router.patch('/:donorId/verification', authorize('FACILITY_USER'), approvedFacility, validate(donorParams, 'params'), validate(verificationSchema), controller.verify);
  router.get('/:donorId/verification-history', authorize('FACILITY_USER'), approvedFacility, validate(donorParams, 'params'), validate(historyQuerySchema, 'query'), controller.history);
  return router;
}
