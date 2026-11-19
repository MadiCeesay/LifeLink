import { apiDocumentation } from './config/apiDocumentation.js';
import { notificationRoutes } from './routes/notificationRoutes.js';
import express from 'express';
import { requestRoutes } from './routes/requestRoutes.js';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { databaseReady } from './config/database.js';
import { authRoutes } from './routes/authRoutes.js';
import { adminRoutes } from './routes/adminRoutes.js';
import { donorRoutes } from './routes/donorRoutes.js';
import { facilityRoutes } from './routes/facilityRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { AppError } from './utils/errors.js';
export function createApp(config, { authLimit = 20, apiLimit = 200 } = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (config.TRUST_PROXY) app.set('trust proxy', config.TRUST_PROXY);
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use(helmet());
  app.use(cors({ origin(origin, callback) {
    if (!origin || config.CORS_ORIGINS.includes(origin)) return callback(null, true);
    callback(new AppError(403, 'CORS_DENIED', 'Origin is not allowed'));
  } }));
  const limiter = limit => rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' } }),
  });
  app.use('/api', limiter(apiLimit));
  app.use(express.json({ limit: '16kb' }));
  app.get('/api/v1/health', (_req, res) => {
    const ready = databaseReady();
    res.status(ready ? 200 : 503).json({ success: ready, ...(ready ? { data: { status: 'ok' } } : { error: { code: 'NOT_READY', message: 'Service is not ready' } }) });
  });
  app.get('/api/v1/docs/openapi.json', (_req, res) => res.json(apiDocumentation));
  app.use('/api/v1/auth', authRoutes(config, limiter(authLimit)));
  app.use('/api/v1/admin', adminRoutes(config));
  app.use('/api/v1/facilities', facilityRoutes(config));
  app.use('/api/v1/donors', donorRoutes(config));
  app.use('/api/v1/requests', requestRoutes(config));
  app.use('/api/v1/notifications', notificationRoutes(config));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
