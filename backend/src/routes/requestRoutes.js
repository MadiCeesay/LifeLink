import { broadcastLimiter } from '../middleware/sensitiveLimit.js';
import * as donation from '../controllers/donationController.js';
import { donationSchema } from '../validators/donation.js';
import { createNotificationController } from '../controllers/notificationController.js';
import { broadcastSchema } from '../validators/notification.js';
import { historyQuerySchema } from '../validators/facility.js';
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { requestParams, requestCreateSchema, cancelSchema, requestQuerySchema } from '../validators/request.js';
import { createRequestController } from '../controllers/requestController.js';
export function requestRoutes(config) {
  const router = Router(); const controller = createRequestController(config);
  router.use(authenticate(config));
  router.post('/:requestId/donations', authorize('FACILITY_USER'), validate(requestParams, 'params'), validate(donationSchema), donation.confirm);
  router.get('/:requestId/donations', authorize('FACILITY_USER'), validate(requestParams, 'params'), validate(historyQuerySchema, 'query'), donation.requestHistory);
  const notification = createNotificationController(config);
  const broadcastLimit = broadcastLimiter(config);
  router.post('/:requestId/broadcast', authorize('FACILITY_USER'), broadcastLimit, validate(requestParams, 'params'), validate(broadcastSchema), notification.broadcast);
  router.get('/:requestId/responses', authorize('FACILITY_USER'), validate(requestParams, 'params'), validate(historyQuerySchema, 'query'), notification.responses);
  router.post('/', authorize('FACILITY_USER'), validate(requestCreateSchema), controller.create);
  router.get('/', authorize('FACILITY_USER', 'ADMIN'), validate(requestQuerySchema, 'query'), controller.list);
  router.get('/:requestId', authorize('FACILITY_USER', 'ADMIN'), validate(requestParams, 'params'), controller.get);
  router.patch('/:requestId/cancel', authorize('FACILITY_USER'), validate(requestParams, 'params'), validate(cancelSchema), controller.cancel);
  return router;
}
