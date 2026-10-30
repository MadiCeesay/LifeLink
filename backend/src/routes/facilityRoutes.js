import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { own } from '../controllers/facilityController.js';
export function facilityRoutes(config) {
  const router = Router();
  router.get('/me', authenticate(config), authorize('FACILITY_USER'), own);
  return router;
}
