import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { notificationParams, notificationQuerySchema, responseSchema } from '../validators/notification.js';
import { clearLocationSchema } from '../validators/location.js';
import { createNotificationController } from '../controllers/notificationController.js';
export function notificationRoutes(config) {
  const router = Router(); const controller = createNotificationController(config);
  router.use(authenticate(config), authorize('DONOR'));
  router.get('/', validate(notificationQuerySchema, 'query'), controller.list);
  router.patch('/:notificationId/read', validate(notificationParams, 'params'), validate(clearLocationSchema), controller.read);
  router.post('/:notificationId/response', validate(notificationParams, 'params'), validate(responseSchema), controller.respond);
  return router;
}
