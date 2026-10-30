import { Router } from 'express';
import { createAuthController } from '../controllers/authController.js';
import { createAuthService } from '../services/authService.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validators/auth.js';
export function authRoutes(config, limiter) {
  const router = Router();
  const controller = createAuthController(createAuthService(config));
  router.post('/register', limiter, validate(registerSchema), controller.register);
  router.post('/login', limiter, validate(loginSchema), controller.login);
  router.get('/me', authenticate(config), controller.me);
  return router;
}
