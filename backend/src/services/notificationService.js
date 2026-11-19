import { getCompatibleDonorBloodTypes } from './compatibilityService.js';
import { recordAudit } from './auditService.js';
import mongoose from 'mongoose';
import { Notification } from '../models/Notification.js';
import { DonorResponse } from '../models/DonorResponse.js';
import { BloodRequest } from '../models/BloodRequest.js';
import { Broadcast } from '../models/Broadcast.js';
import { User } from '../models/User.js';
import { parseInput } from '../utils/parseInput.js';
import { AppError } from '../utils/errors.js';
import { notificationQuerySchema, responseSchema } from '../validators/notification.js';
import { objectId, historyQuerySchema } from '../validators/facility.js';
import { notificationView, responseView } from '../utils/notificationViews.js';
import { assertRequestActive, effectiveRequestStatus, ACTIVE_REQUEST_STATUSES } from '../utils/requestState.js';
import { ownedRequest, requestFacilityActive } from './requestService.js';
import { requireActiveDonor, isCurrentCandidate } from './candidateEligibilityService.js';
import { pushToUsers } from './pushService.js';
import { donorComingMessage } from '../utils/pushMessages.js';
const populateRequest = { path: 'bloodRequest', select: 'requestingFacility patientBloodType unitsNeeded unitsReceived urgency status expiresAt', populate: { path: 'requestingFacility', select: 'name address phone location isActive verificationStatus' } };
export async function listNotifications(actorId, input) {
  await requireActiveDonor(actorId);
  const { page, limit, unread } = parseInput(notificationQuerySchema, input);
  const filter = { recipient: actorId };
  if (unread) filter.status = unread === 'true' ? 'DELIVERED' : 'READ';
  const [rows, total] = await Promise.all([Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).populate(populateRequest), Notification.countDocuments(filter)]);
  const ownResponses = await DonorResponse.find({ donor: actorId, notification: { $in: rows.map(n => n._id) } }).select('notification status');
  const responseByNotification = new Map(ownResponses.map(r => [r.notification.toString(), r]));
  return { notifications: rows.map(n => notificationView(n, responseByNotification.get(n.id))), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
export async function markNotificationRead(actorId, notificationId) {
  await requireActiveDonor(actorId); parseInput(objectId, notificationId);
  await Notification.updateOne({ _id: notificationId, recipient: actorId, readAt: null }, { $set: { status: 'READ', readAt: new Date() } });
  const notification = await Notification.findOne({ _id: notificationId, recipient: actorId }).populate(populateRequest);
  if (!notification) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
  const ownResponse = await DonorResponse.findOne({ donor: actorId, notification: notification._id }).select('status');
  return notificationView(notification, ownResponse);
}
export async function respondToNotification(actorId, notificationId, input, config) {
  parseInput(objectId, notificationId); const data = parseInput(responseSchema, input);
  let accepted = null;
  const view = await mongoose.connection.transaction(async session => {
    accepted = null;
    let donor = await requireActiveDonor(actorId, session, { lock: true, location: true });
    const notification = await Notification.findOne({ _id: notificationId, recipient: actorId }).session(session);
    if (!notification) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
    const request = await BloodRequest.findOneAndUpdate({ _id: notification.bloodRequest }, { $inc: { mutationVersion: 1 } }, { new: true, session });
    if (!request) throw new AppError(404, 'REQUEST_NOT_FOUND', 'Blood request not found');
    assertRequestActive(request); await requestFacilityActive(request, session, true);
    const existing = await DonorResponse.findOne({ bloodRequest: request._id, donor: actorId }).session(session);
    if (existing) {
      if (existing.status !== data.status) throw new AppError(409, 'RESPONSE_FINAL', 'A response is final; an identical retry is idempotent');
      return responseView(existing);
    }
    if (data.status === 'ACCEPTED') {
      if (data.location) {
        if (!donor.locationSharingEnabled) throw new AppError(409, 'LOCATION_SHARING_DISABLED', 'Location sharing is disabled');
        donor = await User.findOneAndUpdate({ _id: donor._id, locationSharingEnabled: true }, { $set: { currentLocation: data.location }, $currentDate: { locationUpdatedAt: true } }, { new: true, session, runValidators: true }).select('+currentLocation +locationUpdatedAt +lastConfirmedDonationAt');
      }
      if (!isCurrentCandidate(donor, request, config, request.broadcastRadiusKm)) throw new AppError(409, 'DONOR_NOT_ELIGIBLE', 'Current platform candidate requirements are not met');
    }
    const [response] = await DonorResponse.create([{ donor: actorId, bloodRequest: request._id, notification: notification._id, status: data.status }], { session });
    await recordAudit(session, actorId, 'DONOR_RESPONDED', 'DonorResponse', response._id, request.requestingFacility, { newStatus: data.status });
    if (data.status === 'ACCEPTED') accepted = { request, donor };
    return responseView(response);
  });
  if (accepted) void notifyStaffOfAcceptance(accepted.request, accepted.donor, config).catch(() => {});
  return view;
}
async function notifyStaffOfAcceptance(request, donor, config) {
  const staff = await User.find({ role: 'FACILITY_USER', isActive: true, facility: request.requestingFacility, facilityPermissions: 'MANAGE_BLOOD_REQUESTS' }).select('_id').limit(50);
  const ids = new Set([request.createdBy.toString(), ...staff.map(u => u.id)]);
  await pushToUsers(config, [...ids].map(id => donorComingMessage(config, request, donor, id)));
}
// Live counts for the hospital's request screen: who was alerted, who is coming, who declined.
export async function requestSummary(actorId, requestId, config) {
  const request = await ownedRequest(actorId, requestId, { adminAllowed: true });
  const [alerted, responses] = await Promise.all([
    Notification.countDocuments({ bloodRequest: request._id }),
    DonorResponse.aggregate([{ $match: { bloodRequest: request._id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  const by = Object.fromEntries(responses.map(r => [r._id, r.n]));
  const last = await Broadcast.findOne({ bloodRequest: request._id }).sort({ createdAt: -1 }).select('createdAt');
  const stages = config.MATCH_RADIUS_STAGES_KM;
  const canWiden = config.AUTO_ESCALATE_MINUTES > 0 && last && request.broadcastStage < stages.length - 1 && ACTIVE_REQUEST_STATUSES.includes(effectiveRequestStatus(request));
  return {
    alerted, accepted: by.ACCEPTED ?? 0, declined: by.DECLINED ?? 0,
    unitsNeeded: request.unitsNeeded, unitsReceived: request.unitsReceived,
    radiusStagesKm: stages, broadcastRadiusKm: request.broadcastRadiusKm, broadcastStage: request.broadcastStage,
    lastBroadcastAt: last?.createdAt ?? null,
    nextWidenAt: canWiden ? new Date(last.createdAt.getTime() + config.AUTO_ESCALATE_MINUTES * 60000) : null,
  };
}
export async function listRequestResponses(actorId, requestId, input) {
  const request = await ownedRequest(actorId, requestId, { permission: 'MANAGE_BLOOD_REQUESTS' });
  const { page, limit } = parseInput(historyQuerySchema, input);
  const [responses, total] = await Promise.all([DonorResponse.find({ bloodRequest: request._id }).sort({ respondedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), DonorResponse.countDocuments({ bloodRequest: request._id })]);
  const active = ACTIVE_REQUEST_STATUSES.includes(effectiveRequestStatus(request));
  const ids = active ? responses.filter(r => r.status === 'ACCEPTED').map(r => r.donor) : [];
  const donors = await User.find({ _id: { $in: ids }, isActive: true, 'donorVerification.status': 'VERIFIED', 'donorVerification.verifiedBloodType': { $in: getCompatibleDonorBloodTypes(request.patientBloodType) } }).select('name phone donorVerification.verifiedBloodType');
  const byId = new Map(donors.map(d => [d.id, d]));
  return { responses: responses.map(r => {
    const donor = byId.get(r.donor.toString());
    return { ...responseView(r), donor: donor ? { id: donor.id, name: donor.name, phone: donor.phone, verifiedBloodType: donor.donorVerification?.verifiedBloodType } : null };
  }), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
