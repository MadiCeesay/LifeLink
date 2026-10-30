import { recordAudit } from './auditService.js';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Facility } from '../models/Facility.js';
import { VerificationEvent } from '../models/VerificationEvent.js';
import { requireAdmin, requireFacilityStaff } from './authorizationService.js';
import { parseInput } from '../utils/parseInput.js';
import { AppError } from '../utils/errors.js';
import { verificationView, eventView } from '../utils/views.js';
import { verificationSchema, verificationStatusSchema } from '../validators/verification.js';
import { objectId, historyQuerySchema } from '../validators/facility.js';
async function loadDonor(donorId, session) {
  parseInput(objectId, donorId);
  const donor = await User.findOne({ _id: donorId, role: 'DONOR' }).session(session ?? null);
  if (!donor) throw new AppError(404, 'DONOR_NOT_FOUND', 'Donor not found');
  return donor;
}
export async function ownVerification(actorId) {
  const donor = await loadDonor(actorId.toString());
  if (!donor.isActive) throw new AppError(403, 'FORBIDDEN', 'Account is inactive');
  const facility = donor.donorVerification?.verifiedByFacility ? await Facility.findById(donor.donorVerification.verifiedByFacility) : null;
  return verificationView(donor, facility);
}
export async function donorForVerification(actorId, donorId) {
  const { facility } = await requireFacilityStaff(actorId);
  const donor = await loadDonor(donorId);
  const v = donor.donorVerification;
  if (v?.verifiedByFacility && v.verifiedByFacility.toString() !== facility.id && v.status !== 'REQUIRES_REVERIFICATION') throw new AppError(403, 'DONOR_SCOPE_DENIED', 'Donor is outside this facility verification scope');
  // Exact-ID lookup only; no donor directory or contact details.
  return { id: donor.id, name: donor.name, verificationStatus: v?.status ?? 'UNVERIFIED', verifiedBloodType: v?.verifiedByFacility?.toString() === facility.id ? v.verifiedBloodType : null };
}
export async function verifyDonor(actorId, donorId, input) {
  const data = parseInput(verificationSchema, input);
  return mongoose.connection.transaction(async session => {
    // Write guards serialize verification with account/facility suspension.
    const { actor, facility } = await requireFacilityStaff(actorId, session);
    const donor = await loadDonor(donorId, session);
    if (donor.id === actor.id) throw new AppError(403, 'SELF_VERIFICATION_DENIED', 'Self verification is not allowed');
    if (!donor.isActive) throw new AppError(409, 'DONOR_INACTIVE', 'Donor account is inactive');
    const previousStatus = donor.donorVerification?.status ?? 'UNVERIFIED';
    if (!['UNVERIFIED', 'REQUIRES_REVERIFICATION'].includes(previousStatus)) throw new AppError(409, 'INVALID_VERIFICATION_TRANSITION', 'Donor must be unverified or require reverification');
    const sequence = (donor.donorVerification?.revision ?? 0) + 1;
    const timestamp = new Date();
    donor.donorVerification = { status: 'VERIFIED', verifiedBloodType: data.verifiedBloodType, verifiedAt: timestamp, verifiedBy: actor._id, verifiedByFacility: facility._id, verificationNotes: data.notes, revision: sequence };
    await donor.save({ session });
    await VerificationEvent.create([{ donor: donor._id, facility: facility._id, performedBy: actor._id, previousStatus, newStatus: 'VERIFIED', verifiedBloodType: data.verifiedBloodType, notes: data.notes, sequence, timestamp }], { session });
    await recordAudit(session, actorId, 'DONOR_VERIFIED', 'User', donor._id, facility._id, { previousStatus, newStatus: 'VERIFIED' });
    return verificationView(donor, facility);
  });
}
const statusTransitions = {
  UNVERIFIED: ['SUSPENDED'], VERIFIED: ['SUSPENDED', 'REQUIRES_REVERIFICATION'],
  REQUIRES_REVERIFICATION: ['SUSPENDED'], SUSPENDED: ['REQUIRES_REVERIFICATION'],
};
export async function changeVerificationStatus(actorId, donorId, input) {
  const { status, reason } = parseInput(verificationStatusSchema, input);
  return mongoose.connection.transaction(async session => {
    await requireAdmin(actorId, session);
    const donor = await loadDonor(donorId, session);
    const v = donor.donorVerification;
    const previousStatus = v?.status ?? 'UNVERIFIED';
    if (!statusTransitions[previousStatus]?.includes(status)) throw new AppError(409, 'INVALID_VERIFICATION_TRANSITION', 'This donor verification status transition is not allowed');
    const sequence = (v?.revision ?? 0) + 1;
    // Preserve historical provenance/blood type; status must gate any future matching.
    donor.set('donorVerification.status', status);
    donor.set('donorVerification.revision', sequence);
    await donor.save({ session });
    await VerificationEvent.create([{ donor: donor._id, facility: v?.verifiedByFacility, performedBy: actorId, previousStatus, newStatus: status, verifiedBloodType: v?.verifiedBloodType, reason, sequence }], { session });
    const facility = v?.verifiedByFacility ? await Facility.findById(v.verifiedByFacility).session(session) : null;
    await recordAudit(session, actorId, 'DONOR_VERIFICATION_CHANGED', 'User', donor._id, v?.verifiedByFacility, { previousStatus, newStatus: status });
    return verificationView(donor, facility);
  });
}
export async function verificationHistory(actorId, donorId, input) {
  parseInput(objectId, donorId);
  const { page, limit } = parseInput(historyQuerySchema, input);
  // Determine access using fresh database records, never token claims.
  const actor = await User.findById(actorId);
  const filter = { donor: donorId };
  if (actor?.role === 'ADMIN') await requireAdmin(actorId);
  else {
    const { facility } = await requireFacilityStaff(actorId);
    filter.facility = facility._id;
    if (!await VerificationEvent.exists(filter)) throw new AppError(403, 'DONOR_SCOPE_DENIED', 'No verification history is available in this facility scope');
  }
  await loadDonor(donorId);
  const [events, total] = await Promise.all([VerificationEvent.find(filter).sort({ sequence: -1 }).skip((page - 1) * limit).limit(limit), VerificationEvent.countDocuments(filter)]);
  return { events: events.map(eventView), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
