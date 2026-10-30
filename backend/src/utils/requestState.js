import { AppError } from './errors.js';
export const ACTIVE_REQUEST_STATUSES = Object.freeze(['OPEN', 'PARTIALLY_FILLED']);
export function effectiveRequestStatus(request, now = new Date()) {
  return ACTIVE_REQUEST_STATUSES.includes(request.status) && request.expiresAt <= now ? 'EXPIRED' : request.status;
}
export function assertRequestActive(request, now = new Date()) {
  if (!ACTIVE_REQUEST_STATUSES.includes(effectiveRequestStatus(request, now)) || !(request.expiresAt instanceof Date) || !Number.isFinite(request.expiresAt.getTime()) || request.expiresAt <= now) throw new AppError(409, 'REQUEST_INACTIVE', 'Blood request is no longer active');
}
const transitions = { OPEN: ['PARTIALLY_FILLED', 'FULFILLED', 'CANCELLED', 'EXPIRED'], PARTIALLY_FILLED: ['FULFILLED', 'CANCELLED', 'EXPIRED'] };
export function transitionRequest(request, next, now = new Date()) {
  if (!transitions[effectiveRequestStatus(request, now)]?.includes(next)) throw new AppError(409, 'INVALID_REQUEST_TRANSITION', 'This blood request transition is not allowed');
  request.status = next;
  if (next === 'CANCELLED') request.cancelledAt = now;
  if (next === 'FULFILLED') request.fulfilledAt = now;
}
