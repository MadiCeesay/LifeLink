import crypto from 'node:crypto';
import { BloodRequest } from '../models/BloodRequest.js';
import { Broadcast } from '../models/Broadcast.js';
import { DonorResponse } from '../models/DonorResponse.js';
import { User } from '../models/User.js';
import { ACTIVE_REQUEST_STATUSES } from '../utils/requestState.js';
import { broadcastRequest } from './broadcastService.js';
import { expireRequests } from './requestService.js';
// Widens the search radius automatically when a broadcast request still lacks willing donors,
// so hospital staff never have to remember to press "expand" during an emergency.
export async function escalateOnce(config, now = new Date()) {
  await expireRequests(now);
  if (!config.AUTO_ESCALATE_MINUTES) return { widened: 0 };
  const cutoff = new Date(now.getTime() - config.AUTO_ESCALATE_MINUTES * 60000);
  const maxStage = config.MATCH_RADIUS_STAGES_KM.length - 1;
  const candidates = await BloodRequest.find({ status: { $in: ACTIVE_REQUEST_STATUSES }, expiresAt: { $gt: now }, broadcastStage: { $gte: 0, $lt: maxStage } }).limit(50);
  let widened = 0;
  for (const request of candidates) {
    const last = await Broadcast.findOne({ bloodRequest: request._id }).sort({ createdAt: -1 }).select('createdAt');
    if (!last || last.createdAt > cutoff) continue;
    const accepted = await DonorResponse.countDocuments({ bloodRequest: request._id, status: 'ACCEPTED' });
    if (accepted >= request.unitsNeeded - request.unitsReceived) continue;
    const actors = [request.createdBy, ...(await User.find({ role: 'FACILITY_USER', isActive: true, facility: request.requestingFacility, facilityPermissions: 'MANAGE_BLOOD_REQUESTS' }).select('_id').limit(5)).map(u => u._id)];
    for (const actor of actors) {
      try {
        await broadcastRequest(actor, request._id.toString(), { idempotencyKey: crypto.randomUUID(), expand: true }, config);
        widened++;
        break;
      } catch (error) {
        if (error?.status === 403 || error?.code === 'FACILITY_ACCESS_DENIED') continue;
        break; // radius exhausted, state changed, etc.: try again next cycle or stop
      }
    }
  }
  return { widened };
}
export function startEscalationLoop(config, intervalMs = 60000) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try { await escalateOnce(config); } catch { /* keep the loop alive */ } finally { running = false; }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
