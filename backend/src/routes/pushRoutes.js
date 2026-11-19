import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { pushEnabled, saveSubscription, removeSubscription } from '../services/pushService.js';
const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000).refine(v => v.startsWith('https://'), 'Push endpoint must use HTTPS'),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(5).max(100) }),
});
export function pushRoutes(config) {
  const router = Router();
  router.get('/config', (_req, res) => res.json({ success: true, data: { enabled: pushEnabled(config), publicKey: config.VAPID_PUBLIC_KEY ?? null } }));
  router.use(authenticate(config));
  router.post('/subscribe', validate(subscriptionSchema), async (req, res) => res.json({ success: true, data: await saveSubscription(req.user._id, req.body, req.get('user-agent')) }));
  router.post('/unsubscribe', validate(z.object({ endpoint: z.string().max(2000) })), async (req, res) => res.json({ success: true, data: await removeSubscription(req.user._id, req.body.endpoint) }));
  return router;
}
