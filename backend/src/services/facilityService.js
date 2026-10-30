import { recordAudit } from './auditService.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Facility } from '../models/Facility.js';
import { User } from '../models/User.js';
import { requireAdmin, requireFacilityStaff } from './authorizationService.js';
import { facilityCreateSchema, facilityActionSchema, staffSchema, facilitiesQuerySchema, objectId } from '../validators/facility.js';
import { parseInput } from '../utils/parseInput.js';
import { AppError } from '../utils/errors.js';
import { facilityView, staffView } from '../utils/views.js';
export async function createFacility(actorId, input) {
  const data = parseInput(facilityCreateSchema, input);
  return mongoose.connection.transaction(async session => {
    await requireAdmin(actorId, session);
    const [facility] = await Facility.create([{ ...data, createdBy: actorId }], { session });
    await recordAudit(session, actorId, 'FACILITY_CREATED', 'Facility', facility._id, facility._id);
    return facilityView(facility, true);
  });
}
export async function listFacilities(actorId, input) {
  await requireAdmin(actorId);
  const { page, limit, status } = parseInput(facilitiesQuerySchema, input);
  const filter = status ? { verificationStatus: status } : {};
  const [facilities, total] = await Promise.all([Facility.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), Facility.countDocuments(filter)]);
  return { facilities: facilities.map(f => facilityView(f, true)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
export async function getFacility(actorId, facilityId) {
  await requireAdmin(actorId);
  parseInput(objectId, facilityId);
  const facility = await Facility.findById(facilityId);
  if (!facility) throw new AppError(404, 'FACILITY_NOT_FOUND', 'Facility not found');
  return facilityView(facility, true);
}
const transitions = {
  approve: { PENDING: 'APPROVED' },
  reject: { PENDING: 'REJECTED' },
  suspend: { APPROVED: 'SUSPENDED' },
  reactivate: { SUSPENDED: 'APPROVED', REJECTED: 'PENDING' },
};
export async function transitionFacility(actorId, facilityId, action, input) {
  const { reason } = parseInput(facilityActionSchema, input);
  parseInput(objectId, facilityId);
  return mongoose.connection.transaction(async session => {
    await requireAdmin(actorId, session);
    const facility = await Facility.findById(facilityId).session(session);
    if (!facility) throw new AppError(404, 'FACILITY_NOT_FOUND', 'Facility not found');
    const previousStatus = facility.verificationStatus;
    const newStatus = transitions[action]?.[previousStatus];
    if (!newStatus) throw new AppError(409, 'INVALID_FACILITY_TRANSITION', 'This facility status transition is not allowed');
    facility.verificationStatus = newStatus;
    facility.isActive = newStatus === 'APPROVED' || newStatus === 'PENDING';
    if (newStatus === 'APPROVED') { facility.approvedAt = new Date(); facility.approvedBy = actorId; }
    if (newStatus === 'REJECTED') facility.rejectionReason = reason;
    facility.statusHistory.push({ previousStatus, newStatus, performedBy: actorId, reason });
    await facility.save({ session });
    await recordAudit(session, actorId, { approve: 'FACILITY_APPROVED', reject: 'FACILITY_REJECTED', suspend: 'FACILITY_SUSPENDED', reactivate: 'FACILITY_REACTIVATED' }[action], 'Facility', facility._id, facility._id, { previousStatus, newStatus });
    return facilityView(facility, true);
  });
}
export async function provisionStaff(actorId, facilityId, input) {
  await requireAdmin(actorId);
  parseInput(objectId, facilityId);
  const data = parseInput(staffSchema, input);
  const password = await bcrypt.hash(data.password, 12);
  return mongoose.connection.transaction(async session => {
    await requireAdmin(actorId, session);
    const facility = await Facility.findOneAndUpdate({ _id: facilityId, verificationStatus: 'APPROVED', isActive: true }, { $inc: { authorizationVersion: 1 } }, { session, new: true });
    if (!facility) throw new AppError(409, 'FACILITY_NOT_APPROVED', 'Staff provisioning requires an approved active facility');
    const [user] = await User.create([{ name: data.name, email: data.email, phone: data.phone, password, role: 'FACILITY_USER', facility: facility._id, facilityPermissions: data.permissions }], { session });
    await recordAudit(session, actorId, 'STAFF_PROVISIONED', 'User', user._id, facility._id, { permissions: user.facilityPermissions });
    return staffView(user);
  });
}
export async function ownFacility(actorId) {
  const { facility } = await requireFacilityStaff(actorId, undefined, null);
  return facilityView(facility);
}

export async function setFacilityLocation(actorId, facilityId, input) {
  const { geoPointSchema } = await import('../validators/location.js');
  const location = parseInput(geoPointSchema, input);
  parseInput(objectId, facilityId);
  return mongoose.connection.transaction(async session => {
    await requireAdmin(actorId, session);
    const facility = await Facility.findByIdAndUpdate(facilityId, { $set: { location, locationUpdatedAt: new Date(), locationUpdatedBy: actorId }, $inc: { authorizationVersion: 1 } }, { new: true, session, runValidators: true });
    if (!facility) throw new AppError(404, 'FACILITY_NOT_FOUND', 'Facility not found');
    await recordAudit(session, actorId, 'FACILITY_LOCATION_CHANGED', 'Facility', facility._id, facility._id);
    return { facilityId: facility.id, location: facility.location.toObject(), locationUpdatedAt: facility.locationUpdatedAt };
  });
}
