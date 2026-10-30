import mongoose from 'mongoose';
import { getCompatibleDonorBloodTypes } from './compatibilityService.js';
// Inputs are validated by matchingService. No HTTP route calls this query builder.
export function buildCandidatePipeline({ recipientBloodType, requestLocation, radiusKm, limit, now, excludedDonorIds = [] }, maxAgeMinutes, donationPauseDays = 56) {
  const cutoff = new Date(now.getTime() - maxAgeMinutes * 60_000);
  return [
    { $geoNear: {
      key: 'currentLocation', near: requestLocation, spherical: true,
      distanceField: 'distanceMeters', maxDistance: radiusKm * 1000,
      query: {
        ...(excludedDonorIds.length ? { _id: { $nin: excludedDonorIds.map(id => new mongoose.Types.ObjectId(id)) } } : {}),
        isActive: true, role: 'DONOR',
        'donorVerification.status': 'VERIFIED',
        'donorVerification.verifiedBloodType': { $in: getCompatibleDonorBloodTypes(recipientBloodType) },
        availabilityStatus: 'AVAILABLE', locationSharingEnabled: true,
        'currentLocation.type': 'Point',
        'currentLocation.coordinates': { $size: 2 },
        locationUpdatedAt: { $gte: cutoff, $lte: now },
        // Reject malformed legacy/raw scalar fields rather than array-element matches.
        $expr: { $and: [
          { $or: [
            { $in: [{ $type: '$lastConfirmedDonationAt' }, ['missing', 'null']] },
            { $and: [{ $eq: [{ $type: '$lastConfirmedDonationAt' }, 'date'] }, { $lte: ['$lastConfirmedDonationAt', new Date(now.getTime() - donationPauseDays * 86400000)] }] },
          ] },
          { $eq: [{ $type: '$isActive' }, 'bool'] },
          { $eq: [{ $type: '$role' }, 'string'] },
          { $eq: [{ $type: '$donorVerification.status' }, 'string'] },
          { $eq: [{ $type: '$donorVerification.verifiedBloodType' }, 'string'] },
          { $eq: [{ $type: '$availabilityStatus' }, 'string'] },
          { $eq: [{ $type: '$locationSharingEnabled' }, 'bool'] },
          { $eq: [{ $type: '$locationUpdatedAt' }, 'date'] },
          { $eq: [{ $type: '$currentLocation' }, 'object'] },
        ] },
      },
    } },
    { $sort: { distanceMeters: 1, _id: 1 } },
    { $limit: limit },
    { $project: { _id: 0, donorId: { $toString: '$_id' }, verifiedBloodType: '$donorVerification.verifiedBloodType', distanceMeters: 1 } },
  ];
}
