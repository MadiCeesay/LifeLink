import { recordAudit } from './auditService.js';
import mongoose from 'mongoose';
import { Donation } from '../models/Donation.js';
import { DonorResponse } from '../models/DonorResponse.js';
import { parseInput } from '../utils/parseInput.js';
import { AppError } from '../utils/errors.js';
import { donationSchema, donationQuerySchema } from '../validators/donation.js';
import { historyQuerySchema } from '../validators/facility.js';
import { donationView } from '../utils/donationState.js';
import { ownedRequest } from './requestService.js';
import { requireActiveDonor } from './candidateEligibilityService.js';
import { requireAdmin } from './authorizationService.js';
import { assertRequestActive, transitionRequest } from '../utils/requestState.js';
import { isBloodTypeCompatible } from './compatibilityService.js';
export async function confirmDonation(actorId, requestId, input) {
  const data = parseInput(donationSchema, input);
  return mongoose.connection.transaction(async session => {
    const request = await ownedRequest(actorId, requestId, { session, permission: 'CONFIRM_DONATIONS', lock: true });
    const existing = await Donation.findOne({ bloodRequest: request._id, donor: data.donorId }).session(session);
    if (existing) {
      if (existing.units !== data.units) throw new AppError(409, 'DONATION_ALREADY_CONFIRMED', 'Donation was already confirmed with different units');
      return donationView(existing);
    }
    assertRequestActive(request);
    if (data.units > request.unitsNeeded - request.unitsReceived) throw new AppError(409, 'UNITS_EXCEED_REMAINING', 'Confirmed units exceed the remaining request requirement');
    const response = await DonorResponse.findOne({ bloodRequest: request._id, donor: data.donorId, status: 'ACCEPTED' }).session(session);
    if (!response) throw new AppError(409, 'ACCEPTED_RESPONSE_REQUIRED', 'A valid accepted donor response is required');
    const donor = await requireActiveDonor(data.donorId, session, { lock: true });
    if (donor.donorVerification?.status !== 'VERIFIED' || !isBloodTypeCompatible({ donorBloodType: donor.donorVerification.verifiedBloodType, recipientBloodType: request.patientBloodType })) throw new AppError(409, 'DONOR_VERIFICATION_REQUIRED', 'Donor verification requires review');
    const confirmedAt = new Date();
    const [donation] = await Donation.create([{ donor: donor._id, bloodRequest: request._id, facility: request.requestingFacility, response: response._id, confirmedBy: actorId, confirmedAt, units: data.units, bloodTypeSnapshot: donor.donorVerification.verifiedBloodType }], { session });
    request.unitsReceived += data.units;
    if (request.unitsReceived >= request.unitsNeeded) transitionRequest(request, 'FULFILLED', confirmedAt);
    else if (request.status === 'OPEN') transitionRequest(request, 'PARTIALLY_FILLED', confirmedAt);
    await request.save({ session });
    donor.lastConfirmedDonationAt = confirmedAt; await donor.save({ session });
    await recordAudit(session, actorId, 'DONATION_CONFIRMED', 'Donation', donation._id, request.requestingFacility, { units: data.units });
    return donationView(donation);
  });
}
async function pageDonations(filter, query) {
  const { page, limit } = query;
  const [rows, total] = await Promise.all([Donation.find(filter).sort({ confirmedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), Donation.countDocuments(filter)]);
  return { donations: rows.map(donationView), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
export async function ownDonations(actorId, input) {
  await requireActiveDonor(actorId); return pageDonations({ donor: actorId }, parseInput(historyQuerySchema, input));
}
export async function requestDonations(actorId, requestId, input) {
  const request = await ownedRequest(actorId, requestId, { permission: 'CONFIRM_DONATIONS' });
  return pageDonations({ bloodRequest: request._id }, parseInput(historyQuerySchema, input));
}
export async function adminDonations(actorId, input) {
  await requireAdmin(actorId); const query = parseInput(donationQuerySchema, input);
  const filter = {}; if (query.facilityId) filter.facility = query.facilityId; if (query.donorId) filter.donor = query.donorId;
  return pageDonations(filter, query);
}
