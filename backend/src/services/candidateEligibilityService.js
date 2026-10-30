import { isDonationPaused } from '../utils/donationState.js';
import { BLOOD_TYPES } from '../config/domain.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/errors.js';
import { isLocationReady, hasValidLocation } from '../utils/locationState.js';
import { isBloodTypeCompatible } from './compatibilityService.js';
export async function requireActiveDonor(actorId, session, { lock = false, location = false } = {}) {
  const filter = { _id: actorId, role: 'DONOR', isActive: true };
  let query = lock ? User.findOneAndUpdate(filter, { $inc: { authorizationVersion: 1 } }, { new: true, session }) : User.findOne(filter).session(session ?? null);
  if (location) query = query.select('+currentLocation +locationUpdatedAt +lastConfirmedDonationAt');
  const donor = await query;
  if (!donor) throw new AppError(403, 'DONOR_ACCESS_DENIED', 'An active donor account is required');
  return donor;
}
export function distanceMeters(a, b) {
  const rad = value => value * Math.PI / 180;
  const [lng1, lat1] = a.coordinates; const [lng2, lat2] = b.coordinates;
  const h = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6378100 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function isCurrentCandidate(donor, request, config, radiusKm, now = new Date()) {
  return isLocationReady(donor, config.DONOR_LOCATION_MAX_AGE_MINUTES, now)
    && !isDonationPaused(donor, config.DONATION_MATCHING_PAUSE_DAYS, now)
    && donor.donorVerification?.status === 'VERIFIED'
    && BLOOD_TYPES.includes(donor.donorVerification.verifiedBloodType)
    && isBloodTypeCompatible({ donorBloodType: donor.donorVerification.verifiedBloodType, recipientBloodType: request.patientBloodType })
    && hasValidLocation(request.requestLocation)
    && distanceMeters(donor.currentLocation, request.requestLocation) <= radiusKm * 1000;
}
