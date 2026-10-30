import { hasValidLocation, isLocationFresh, isLocationReady } from './locationState.js';
export function facilityView(facility, admin = false) {
  const data = { id: facility._id.toString(), name: facility.name, facilityType: facility.facilityType, phone: facility.phone, email: facility.email, address: facility.address, verificationStatus: facility.verificationStatus, isActive: facility.isActive };
  if (admin) Object.assign(data, { referenceNumber: facility.referenceNumber, approvedAt: facility.approvedAt, approvedBy: facility.approvedBy, rejectionReason: facility.rejectionReason, createdBy: facility.createdBy, createdAt: facility.createdAt, updatedAt: facility.updatedAt,
    statusHistory: facility.statusHistory.map(e => ({ previousStatus: e.previousStatus, newStatus: e.newStatus, performedBy: e.performedBy, reason: e.reason, timestamp: e.timestamp })) });
  return data;
}
export function verificationView(donor, facility) {
  const v = donor.donorVerification;
  return { verificationStatus: v?.status ?? 'UNVERIFIED', verifiedBloodType: v?.verifiedBloodType ?? null, verifiedAt: v?.verifiedAt ?? null,
    verifiedByFacility: facility ? { id: facility._id.toString(), name: facility.name, facilityType: facility.facilityType } : null };
}
export function eventView(event) {
  return { id: event._id.toString(), donorId: event.donor.toString(), facilityId: event.facility?.toString() ?? null, performedBy: event.performedBy.toString(), previousStatus: event.previousStatus, newStatus: event.newStatus,
    verifiedBloodType: event.verifiedBloodType ?? null, reason: event.reason, notes: event.notes, sequence: event.sequence, timestamp: event.timestamp };
}
export function staffView(user) {
  return { id: user._id.toString(), name: user.name, email: user.email, phone: user.phone, role: user.role, facilityId: user.facility.toString(), permissions: user.facilityPermissions, isActive: user.isActive, createdAt: user.createdAt };
}

export function ownLocationView(donor, maxAgeMinutes, now = new Date()) {
  const hasLocation = hasValidLocation(donor.currentLocation);
  return {
    availabilityStatus: donor.availabilityStatus ?? 'UNAVAILABLE',
    locationSharingEnabled: donor.locationSharingEnabled === true,
    hasLocation,
    currentLocation: hasLocation ? { type: 'Point', coordinates: [...donor.currentLocation.coordinates] } : null,
    locationUpdatedAt: hasLocation && donor.locationUpdatedAt instanceof Date && Number.isFinite(donor.locationUpdatedAt.getTime()) ? donor.locationUpdatedAt : null,
    isLocationFresh: isLocationFresh(donor, maxAgeMinutes, now),
    locationReady: isLocationReady(donor, maxAgeMinutes, now),
  };
}
