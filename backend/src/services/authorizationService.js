import { User } from '../models/User.js';
import { Facility } from '../models/Facility.js';
import { AppError } from '../utils/errors.js';
export async function requireAdmin(actorId, session) {
  const filter = { _id: actorId, role: 'ADMIN', isActive: true };
  const actor = session ? await User.findOneAndUpdate(filter, { $inc: { authorizationVersion: 1 } }, { new: true, session }) : await User.findOne(filter);
  if (!actor) throw new AppError(403, 'FORBIDDEN', 'Active administrator access is required');
  return actor;
}
export async function requireFacilityStaff(actorId, session, permission = 'VERIFY_DONORS') {
  const filter = { _id: actorId, role: 'FACILITY_USER', isActive: true, facility: { $ne: null } };
  if (permission) filter.facilityPermissions = permission;
  const actor = session ? await User.findOneAndUpdate(filter, { $inc: { authorizationVersion: 1 } }, { new: true, session }) : await User.findOne(filter);
  if (!actor?.facility) throw new AppError(403, 'FACILITY_ACCESS_DENIED', 'Authorized facility membership is required');
  const facilityFilter = { _id: actor.facility, verificationStatus: 'APPROVED', isActive: true };
  const facility = session ? await Facility.findOneAndUpdate(facilityFilter, { $inc: { authorizationVersion: 1 } }, { new: true, session }) : await Facility.findOne(facilityFilter);
  if (!facility) throw new AppError(403, 'FACILITY_ACCESS_DENIED', 'An approved active facility is required');
  return { actor, facility };
}
