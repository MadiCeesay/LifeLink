import { recordAudit } from './auditService.js';
import mongoose from 'mongoose';
import { BloodRequest } from '../models/BloodRequest.js';
import { User } from '../models/User.js';
import { Facility } from '../models/Facility.js';
import { requireAdmin, requireFacilityStaff } from './authorizationService.js';
import { parseInput } from '../utils/parseInput.js';
import { AppError } from '../utils/errors.js';
import { requestCreateSchema, cancelSchema, requestQuerySchema } from '../validators/request.js';
import { objectId } from '../validators/facility.js';
import { geoPointSchema } from '../validators/location.js';
import { requestView } from '../utils/requestViews.js';
import { ACTIVE_REQUEST_STATUSES, assertRequestActive, transitionRequest } from '../utils/requestState.js';
export async function facilityForRequest(actorId, session, permission) { return requireFacilityStaff(actorId, session, permission); }
export async function ownedRequest(actorId, requestId, { session, permission = null, adminAllowed = false, lock = false } = {}) {
  parseInput(objectId, requestId);
  const actor = await User.findById(actorId).session(session ?? null);
  const filter = { _id: requestId };
  if (adminAllowed && actor?.role === 'ADMIN') await requireAdmin(actorId, session);
  else { const { facility } = await facilityForRequest(actorId, session, permission); filter.requestingFacility = facility._id; }
  const request = lock ? await BloodRequest.findOneAndUpdate(filter, { $inc: { mutationVersion: 1 } }, { new: true, session }) : await BloodRequest.findOne(filter).session(session ?? null);
  if (!request) throw new AppError(404, 'REQUEST_NOT_FOUND', 'Blood request not found');
  return request;
}
export async function createBloodRequest(actorId, input, config) {
  const data = parseInput(requestCreateSchema, input);
  return mongoose.connection.transaction(async session => {
    const { facility } = await facilityForRequest(actorId, session, 'CREATE_BLOOD_REQUESTS');
    const point = geoPointSchema.safeParse(facility.location?.toObject());
    if (!point.success) throw new AppError(409, 'FACILITY_LOCATION_REQUIRED', 'Administrator must set the facility location first');
    const now = new Date();
    if (data.expiresAt <= now || data.expiresAt.getTime() - now.getTime() > config.BLOOD_REQUEST_MAX_LIFETIME_HOURS * 3600000) throw new AppError(400, 'INVALID_EXPIRY', 'Expiry must be in the future and within the configured request lifetime');
    const [request] = await BloodRequest.create([{ ...data, requestingFacility: facility._id, createdBy: actorId, requestLocation: point.data }], { session });
    await recordAudit(session, actorId, 'REQUEST_CREATED', 'BloodRequest', request._id, request.requestingFacility);
    return requestView(request);
  });
}
export async function getBloodRequest(actorId, requestId) { return requestView(await ownedRequest(actorId, requestId, { adminAllowed: true })); }
export async function listBloodRequests(actorId, input) {
  const { page, limit, status, urgency } = parseInput(requestQuerySchema, input);
  const actor = await User.findById(actorId);
  const filter = {};
  if (actor?.role === 'ADMIN') await requireAdmin(actorId);
  else { const { facility } = await facilityForRequest(actorId, undefined, null); filter.requestingFacility = facility._id; }
  const now = new Date();
  if (status === 'EXPIRED') filter.$or = [{ status: 'EXPIRED' }, { status: { $in: ACTIVE_REQUEST_STATUSES }, expiresAt: { $lte: now } }];
  else if (status) { filter.status = status; if (ACTIVE_REQUEST_STATUSES.includes(status)) filter.expiresAt = { $gt: now }; }
  if (urgency) filter.urgency = urgency;
  const [requests, total] = await Promise.all([BloodRequest.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), BloodRequest.countDocuments(filter)]);
  return { requests: requests.map(r => requestView(r, now)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
export async function cancelBloodRequest(actorId, requestId, input) {
  const { reason } = parseInput(cancelSchema, input);
  return mongoose.connection.transaction(async session => {
    const request = await ownedRequest(actorId, requestId, { session, permission: 'MANAGE_BLOOD_REQUESTS', lock: true });
    assertRequestActive(request); transitionRequest(request, 'CANCELLED'); request.cancellationReason = reason;
    await request.save({ session });
    await recordAudit(session, actorId, 'REQUEST_CANCELLED', 'BloodRequest', request._id, request.requestingFacility, { newStatus: 'CANCELLED' });
    return requestView(request);
  });
}
export async function expireRequests(now = new Date()) {
  return BloodRequest.updateMany({ status: { $in: ACTIVE_REQUEST_STATUSES }, expiresAt: { $lte: now } }, { $set: { status: 'EXPIRED' } });
}
export async function requestFacilityActive(request, session, lock = false) {
  const filter = { _id: request.requestingFacility, verificationStatus: 'APPROVED', isActive: true };
  const facility = lock ? await Facility.findOneAndUpdate(filter, { $inc: { authorizationVersion: 1 } }, { new: true, session }) : await Facility.findOne(filter).session(session ?? null);
  if (!facility) throw new AppError(409, 'REQUEST_FACILITY_UNAVAILABLE', 'Requesting facility is not approved and active');
  return facility;
}
