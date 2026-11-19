import { Router } from 'express';
import { createAuthController } from '../controllers/authController.js';
import { createAuthService } from '../services/authService.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, otpRequestSchema, otpVerifySchema, otpCompleteSchema, passwordResetSchema } from '../validators/auth.js';
export function authRoutes(config, limiter) {
  const router = Router();
  const controller = createAuthController(createAuthService(config));
  router.get('/options', controller.options);
  router.post('/register', limiter, validate(registerSchema), controller.register);
  router.post('/login', limiter, validate(loginSchema), controller.login);
  router.post('/code/request', limiter, validate(otpRequestSchema), controller.requestCode);
  router.post('/code/verify', limiter, validate(otpVerifySchema), controller.verifyCode);
  router.post('/code/complete', limiter, validate(otpCompleteSchema), controller.completeSignup);
  router.post('/password/reset', limiter, validate(passwordResetSchema), controller.resetPassword);
  router.get('/me', authenticate(config), controller.me);
  return router;
}
