import { AppError } from '../utils/errors.js';
export const notFound = (_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Route not found'));
export function errorHandler(err, _req, res, _next) {
  if (res.headersSent) return _next(err);
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details;
  if (err instanceof AppError) ({ status, code, message, details } = err);
  else if (err.code === 11000) { status = 409; const email = err.keyPattern?.email || Object.hasOwn(err.keyValue ?? {}, 'email'); code = email ? 'EMAIL_IN_USE' : 'RESOURCE_CONFLICT'; message = email ? 'An account with this email already exists' : 'Conflicting operation; reload and retry'; }
  else if (['MongoServerSelectionError', 'MongoNetworkError', 'MongoNotConnectedError', 'MongoTopologyClosedError'].includes(err.name)) { status = 503; code = 'DATABASE_UNAVAILABLE'; message = 'Service is temporarily unavailable'; }
  else if (err.type === 'entity.too.large') { status = 413; code = 'BODY_TOO_LARGE'; message = 'Request body is too large'; }
  else if (err.type === 'entity.parse.failed') { status = 400; code = 'INVALID_JSON'; message = 'Request body must be valid JSON'; }
  else if (err.name === 'ValidationError' || err.name === 'CastError') { status = 400; code = 'VALIDATION_ERROR'; message = 'Invalid input'; }
  if (status === 500) console.error('Request failed:', err.name);
  res.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) } });
}
