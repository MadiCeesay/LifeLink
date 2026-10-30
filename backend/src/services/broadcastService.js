import { recordAudit } from './auditService.js';
import mongoose from 'mongoose';
import { Notification } from '../models/Notification.js';
import { Broadcast } from '../models/Broadcast.js';
import { ownedRequest } from './requestService.js';
import { assertRequestActive } from '../utils/requestState.js';
import { createMatchingService } from './matchingService.js';
import { parseInput } from '../utils/parseInput.js';
import { broadcastSchema } from '../validators/notification.js';
import { AppError } from '../utils/errors.js';
import { broadcastView } from '../utils/notificationViews.js';
import { notificationProvider } from './notificationProviders.js';
import { requireActiveDonor, isCurrentCandidate } from './candidateEligibilityService.js';
export async function broadcastRequest(actorId, requestId, input, config) {
  const data = parseInput(broadcastSchema, input);
  const request = await ownedRequest(actorId, requestId, { permission: 'MANAGE_BLOOD_REQUESTS' });
  assertRequestActive(request);
  const prior = await Broadcast.findOne({ bloodRequest: request._id, idempotencyKey: data.idempotencyKey });
  if (prior) return broadcastView(prior);
  const excludedDonorIds = (await Notification.distinct('recipient', { bloodRequest: request._id })).map(id => id.toString());
  if (excludedDonorIds.length >= 1000) throw new AppError(409, 'NOTIFICATION_CAP_REACHED', 'Request notification cap reached');
  const next = request.broadcastStage < 0 ? 0 : request.broadcastStage + (data.expand ? 1 : 0);
  if (next >= config.MATCH_RADIUS_STAGES_KM.length) throw new AppError(409, 'RADIUS_EXHAUSTED', 'Maximum configured radius has been reached');
  if (config.MATCH_RADIUS_STAGES_KM[next] < request.broadcastRadiusKm) throw new AppError(409, 'RADIUS_POLICY_CHANGED', 'Radius configuration needs administrative review');
  const result = await createMatchingService({ ...config, MATCH_RADIUS_STAGES_KM: config.MATCH_RADIUS_STAGES_KM.slice(0, next + 1) }).findCandidatesProgressively({ recipientBloodType: request.patientBloodType, requestLocation: request.requestLocation.toObject(), desiredCandidates: Math.min(data.desiredCandidates, 1000 - excludedDonorIds.length), excludedDonorIds });
  return mongoose.connection.transaction(async session => {
    const current = await ownedRequest(actorId, requestId, { session, permission: 'MANAGE_BLOOD_REQUESTS', lock: true });
    assertRequestActive(current);
    const existing = await Broadcast.findOne({ bloodRequest: current._id, idempotencyKey: data.idempotencyKey }).session(session);
    if (existing) return broadcastView(existing);
    if (current.broadcastStage !== request.broadcastStage || current.broadcastRadiusKm !== request.broadcastRadiusKm) throw new AppError(409, 'BROADCAST_STATE_CHANGED', 'Broadcast radius changed; reload the request before expanding');
    let notifiedCount = 0;
    const remaining = 1000 - await Notification.countDocuments({ bloodRequest: current._id }).session(session);
    for (const candidate of result.candidates.slice(0, remaining)) {
      if (await Notification.exists({ bloodRequest: current._id, recipient: candidate.donorId, channel: 'IN_APP' }).session(session)) continue;
      let donor;
      try { donor = await requireActiveDonor(candidate.donorId, session, { lock: true, location: true }); }
      catch (error) { if (error.code === 'DONOR_ACCESS_DENIED') continue; throw error; }
      if (!isCurrentCandidate(donor, current, config, result.radiusUsedKm)) continue;
      await notificationProvider('IN_APP').publish({ recipient: donor._id, bloodRequest: current._id, radiusKm: result.radiusUsedKm }, session);
      notifiedCount++;
    }
    current.broadcastRadiusKm = Math.max(current.broadcastRadiusKm, result.radiusUsedKm);
    current.broadcastStage = config.MATCH_RADIUS_STAGES_KM.indexOf(current.broadcastRadiusKm);
    await current.save({ session });
    const [broadcast] = await Broadcast.create([{ bloodRequest: current._id, idempotencyKey: data.idempotencyKey, initiatedBy: actorId, radiusUsedKm: current.broadcastRadiusKm, candidateCount: result.candidateCount, notifiedCount }], { session });
    await recordAudit(session, actorId, 'BROADCAST_INITIATED', 'BloodRequest', current._id, current.requestingFacility, { radiusKm: current.broadcastRadiusKm, notificationCount: notifiedCount });
    return broadcastView(broadcast);
  });
}
