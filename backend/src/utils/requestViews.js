import { effectiveRequestStatus } from './requestState.js';
export function requestView(r, now = new Date()) {
  return { id: r.id, requestingFacility: r.requestingFacility.toString(), createdBy: r.createdBy.toString(), patientBloodType: r.patientBloodType, unitsNeeded: r.unitsNeeded, unitsReceived: r.unitsReceived, remainingUnits: Math.max(0, r.unitsNeeded - r.unitsReceived), urgency: r.urgency, status: effectiveRequestStatus(r, now), requestLocation: { type: 'Point', coordinates: [...r.requestLocation.coordinates] }, expiresAt: r.expiresAt, fulfilledAt: r.fulfilledAt, cancelledAt: r.cancelledAt, cancellationReason: r.cancellationReason, createdAt: r.createdAt, updatedAt: r.updatedAt };
}
