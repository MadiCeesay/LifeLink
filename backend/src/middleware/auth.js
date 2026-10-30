import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { verifyToken } from '../services/authService.js';
import { AppError } from '../utils/errors.js';
export const authenticate = config => async (req, _res, next) => {
  const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? '');
  if (!match) throw new AppError(401, 'UNAUTHENTICATED', 'A valid bearer token is required');
  let payload;
  try { payload = verifyToken(match[1], config); }
  catch { throw new AppError(401, 'UNAUTHENTICATED', 'Invalid or expired token'); }
  if (typeof payload !== 'object' || !mongoose.isObjectIdOrHexString(payload.sub)) throw new AppError(401, 'UNAUTHENTICATED', 'Invalid or expired token');
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw new AppError(401, 'UNAUTHENTICATED', 'Account is unavailable');
  if ((payload.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) throw new AppError(401, 'UNAUTHENTICATED', 'Session is no longer valid');
  req.user = user;
  next();
};
export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required'));
  if (!roles.includes(req.user.role)) return next(new AppError(403, 'FORBIDDEN', 'You do not have permission for this action'));
  next();
};
