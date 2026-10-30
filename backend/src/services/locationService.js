import { User } from '../models/User.js';
import { AppError } from '../utils/errors.js';
import { parseInput } from '../utils/parseInput.js';
import { ownLocationView } from '../utils/views.js';
import { availabilitySchema, locationSharingSchema, geoPointSchema, clearLocationSchema } from '../validators/location.js';
const privateProjection = '+currentLocation +locationUpdatedAt';
const ownActiveDonor = actorId => ({ _id: actorId, role: 'DONOR', isActive: true });
async function readDonor(actorId) {
  const donor = await User.findOne(ownActiveDonor(actorId)).select(privateProjection);
  if (!donor) throw new AppError(403, 'DONOR_ACCESS_DENIED', 'An active donor account is required');
  return donor;
}
async function mutate(actorId, update, config, requireConsent = false) {
  const filter = ownActiveDonor(actorId);
  if (requireConsent) filter.locationSharingEnabled = true;
  const donor = await User.findOneAndUpdate(filter, update, { new: true, runValidators: true }).select(privateProjection);
  if (!donor) {
    await readDonor(actorId);
    throw new AppError(409, 'LOCATION_SHARING_DISABLED', 'Enable location sharing before updating your location');
  }
  return ownLocationView(donor, config.DONOR_LOCATION_MAX_AGE_MINUTES);
}
export async function getOwnLocation(actorId, config) {
  return ownLocationView(await readDonor(actorId), config.DONOR_LOCATION_MAX_AGE_MINUTES);
}
export async function setAvailability(actorId, input, config) {
  const data = parseInput(availabilitySchema, input);
  return mutate(actorId, { $set: { availabilityStatus: data.availabilityStatus } }, config);
}
export async function setLocationSharing(actorId, input, config) {
  const { locationSharingEnabled } = parseInput(locationSharingSchema, input);
  const update = { $set: { locationSharingEnabled } };
  if (!locationSharingEnabled) update.$unset = { currentLocation: '', locationUpdatedAt: '' };
  return mutate(actorId, update, config);
}
export async function updateOwnLocation(actorId, input, config) {
  const currentLocation = parseInput(geoPointSchema, input);
  // Consent and the location write are checked atomically on the same user document.
  return mutate(actorId, { $set: { currentLocation }, $currentDate: { locationUpdatedAt: true } }, config, true);
}
export async function clearOwnLocation(actorId, input, config) {
  parseInput(clearLocationSchema, input);
  return mutate(actorId, { $set: { locationSharingEnabled: false }, $unset: { currentLocation: '', locationUpdatedAt: '' } }, config);
}
