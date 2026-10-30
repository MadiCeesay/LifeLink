import { geoPointSchema } from '../validators/location.js';
export function hasValidLocation(location) {
  if (!location) return false;
  return geoPointSchema.safeParse({ type: location.type, coordinates: location.coordinates }).success;
}
export function isLocationFresh(donor, maxAgeMinutes, now = new Date()) {
  if (!hasValidLocation(donor?.currentLocation) || !(donor?.locationUpdatedAt instanceof Date) || !(now instanceof Date)) return false;
  if (!Number.isSafeInteger(maxAgeMinutes) || maxAgeMinutes <= 0) return false;
  const age = now.getTime() - donor.locationUpdatedAt.getTime();
  // Exactly at the threshold is fresh; invalid/future timestamps are not.
  return Number.isFinite(age) && age >= 0 && age <= maxAgeMinutes * 60_000;
}
export function isLocationReady(donor, maxAgeMinutes, now = new Date()) {
  return donor?.isActive === true && donor.role === 'DONOR' && donor.availabilityStatus === 'AVAILABLE'
    && donor.locationSharingEnabled === true && isLocationFresh(donor, maxAgeMinutes, now);
}
