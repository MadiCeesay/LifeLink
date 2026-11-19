import { z } from 'zod';
import { radiusStagesEnvSchema } from '../validators/matching.js';
const schema = z.object({
  MATCH_RADIUS_STAGES_KM: radiusStagesEnvSchema,
  BLOOD_REQUEST_MAX_LIFETIME_HOURS: z.coerce.number().int().min(1).max(720).default(72),
  DONATION_MATCHING_PAUSE_DAYS: z.coerce.number().int().min(1).max(365).default(56),
  BROADCAST_RATE_LIMIT: z.coerce.number().int().min(1).max(1000).default(20),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DONOR_LOCATION_MAX_AGE_MINUTES: z.coerce.number().int().min(1).max(10080).default(60),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  // Interface to bind. Defaults to 0.0.0.0 in production (required by Render and other hosts), loopback otherwise.
  HOST: z.preprocess(v => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().min(1).optional()),
  // Number of reverse proxies in front of the API (Render = 1). Needed so rate limits see real client IPs.
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\/\S+$/),
  JWT_SECRET: z.string().trim().min(32).refine(v => !/^(change|replace|your|example)/i.test(v), 'Use a randomly generated secret'),
  JWT_EXPIRES_IN: z.string().regex(/^[1-9]\d*(s|m|h|d)$/).default('1h').refine(v => {
    const units = { s: 1, m: 60, h: 3600, d: 86400 };
    return Number(v.slice(0, -1)) * units[v.slice(-1)] <= 86400;
  }, 'Token lifetime must not exceed one day'),
  CORS_ORIGINS: z.string().default('http://localhost:3000').transform(v => v.split(',').map(s => s.trim())).pipe(z.array(z.string().url().refine(v => {
    try {
      const u = new URL(v);
      return ['http:', 'https:'].includes(u.protocol) && u.origin === v;
    } catch { return false; }
  }, 'Use explicit HTTP(S) origins without trailing slashes')).min(1)),
});
export function parseEnv(input) {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map(i => i.path.join('.')))];
    throw new Error(`Invalid environment configuration: ${fields.join(', ')}`);
  }
  return result.data;
}
