import { ownedRequest } from './requestService.js';
import { assertRequestActive } from '../utils/requestState.js';
import { createMatchingService } from './matchingService.js';
export async function matchBloodRequest(actorId, requestId, config) {
  const request = await ownedRequest(actorId, requestId, { permission: 'MANAGE_BLOOD_REQUESTS' });
  assertRequestActive(request);
  return createMatchingService(config).findCandidatesProgressively({ recipientBloodType: request.patientBloodType, requestLocation: request.requestLocation.toObject(), desiredCandidates: Math.min(100, Math.max(1, request.unitsNeeded * 5)) });
}
