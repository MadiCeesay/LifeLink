import { rateLimit } from 'express-rate-limit';
export const broadcastLimiter = config => rateLimit({
  windowMs: 15 * 60 * 1000, limit: config.BROADCAST_RATE_LIMIT,
  keyGenerator: req => req.user.id,
  standardHeaders: 'draft-8', legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many broadcast operations. Try again later.' } }),
});
