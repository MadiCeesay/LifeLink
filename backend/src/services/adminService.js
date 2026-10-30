import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Facility } from '../models/Facility.js';
import { BloodRequest } from '../models/BloodRequest.js';
import { Donation } from '../models/Donation.js';
import { requireAdmin } from './authorizationService.js';
import { recordAudit } from './auditService.js';
import { parseInput } from '../utils/parseInput.js';
import { AppError } from '../utils/errors.js';
import { objectId } from '../validators/facility.js';
import { accountStatusSchema, staffPermissionsSchema } from '../validators/admin.js';
export async function setAccountStatus(actorId, userId, input) {
  parseInput(objectId, userId); const data = parseInput(accountStatusSchema, input);
  return mongoose.connection.transaction(async session => {
    await requireAdmin(actorId, session);
    if (actorId.toString().toLowerCase() === userId.toLowerCase() && !data.isActive) throw new AppError(409, 'SELF_DEACTIVATION_DENIED', 'Administrators cannot deactivate themselves');
    const target = await User.findById(userId).session(session);
    if (!target) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Account not found');
    if (target.role === 'ADMIN' && !data.isActive && await User.countDocuments({ role: 'ADMIN', isActive: true }).session(session) <= 1) throw new AppError(409, 'LAST_ADMIN_PROTECTED', 'Cannot deactivate the last active administrator');
    if (target.isActive !== data.isActive) target.tokenVersion = (target.tokenVersion ?? 0) + 1;
    target.isActive = data.isActive; await target.save({ session });
    await recordAudit(session, actorId, 'ACCOUNT_STATUS_CHANGED', 'User', target._id, target.facility, { isActive: data.isActive, reasonCode: data.reasonCode });
    return { id: target.id, role: target.role, isActive: target.isActive };
  });
}
export async function setStaffPermissions(actorId, facilityId, userId, input) {
  parseInput(objectId, facilityId); parseInput(objectId, userId); const data = parseInput(staffPermissionsSchema, input);
  return mongoose.connection.transaction(async session => {
    await requireAdmin(actorId, session);
    const facility = await Facility.findById(facilityId).session(session);
    if (!facility) throw new AppError(404, 'FACILITY_NOT_FOUND', 'Facility not found');
    const staff = await User.findOne({ _id: userId, role: 'FACILITY_USER', facility: facilityId }).session(session);
    if (!staff) throw new AppError(404, 'STAFF_NOT_FOUND', 'Associated facility staff not found');
    staff.facilityPermissions = data.permissions; await staff.save({ session });
    await recordAudit(session, actorId, 'STAFF_PERMISSIONS_CHANGED', 'User', staff._id, facility._id, { permissions: data.permissions });
    return { id: staff.id, facilityId: facility.id, permissions: staff.facilityPermissions };
  });
}
export async function platformStats(actorId) {
  await requireAdmin(actorId); const now = new Date();
  const [donors, verifiedDonors, availableDonors, approvedFacilities, openRequests, fulfilledRequests, confirmedDonations] = await Promise.all([
    User.countDocuments({ role: 'DONOR' }), User.countDocuments({ role: 'DONOR', isActive: true, 'donorVerification.status': 'VERIFIED' }),
    User.countDocuments({ role: 'DONOR', isActive: true, availabilityStatus: 'AVAILABLE' }), Facility.countDocuments({ verificationStatus: 'APPROVED', isActive: true }),
    BloodRequest.countDocuments({ status: { $in: ['OPEN', 'PARTIALLY_FILLED'] }, expiresAt: { $gt: now } }), BloodRequest.countDocuments({ status: 'FULFILLED' }), Donation.countDocuments({}),
  ]);
  return { donors, verifiedDonors, availableDonors, approvedFacilities, openRequests, fulfilledRequests, confirmedDonations };
}
