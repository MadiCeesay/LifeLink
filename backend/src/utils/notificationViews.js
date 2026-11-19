import { effectiveRequestStatus, ACTIVE_REQUEST_STATUSES } from './requestState.js';
export function broadcastView(b) { return { id: b.id, bloodRequest: b.bloodRequest.toString(), radiusUsedKm: b.radiusUsedKm, candidateCount: b.candidateCount, notifiedCount: b.notifiedCount, createdAt: b.createdAt }; }
export function responseView(r) { return { id: r.id, bloodRequest: r.bloodRequest.toString(), status: r.status, respondedAt: r.respondedAt }; }
export function notificationView(n, ownResponse) {
  const request = n.bloodRequest;
  const facility = request?.requestingFacility;
  const status = request?.status ? effectiveRequestStatus(request) : null;
  return { id: n.id, responseStatus: ownResponse?.status ?? 'PENDING', channel: n.channel, status: n.status, sentAt: n.sentAt, readAt: n.readAt ?? null,
    bloodRequest: request?.status ? { id: request.id, patientBloodType: request.patientBloodType, unitsNeeded: request.unitsNeeded, remainingUnits: Math.max(0, request.unitsNeeded - request.unitsReceived), urgency: request.urgency, status, expiresAt: request.expiresAt,
      facility: facility?.name ? { id: facility.id, name: facility.name, address: facility.address, phone: facility.phone ?? null, coordinates: facility.location?.coordinates?.length === 2 ? facility.location.coordinates : null } : null,
      actionable: ACTIVE_REQUEST_STATUSES.includes(status) && facility?.isActive === true && facility?.verificationStatus === 'APPROVED' } : null };
}
