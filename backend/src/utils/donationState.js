export function isDonationPaused(donor, days, now = new Date()) {
  if (donor?.$errors?.lastConfirmedDonationAt) return true;
  const date = donor?.lastConfirmedDonationAt;
  if (date === null || date === undefined) return false;
  if (!(date instanceof Date) || !Number.isFinite(date.getTime()) || !(now instanceof Date) || !Number.isFinite(now.getTime())) return true;
  return now.getTime() - date.getTime() < days * 86400000;
}
export function donationView(d) {
  return { id: d.id, donorId: d.donor.toString(), bloodRequest: d.bloodRequest.toString(), facilityId: d.facility.toString(), confirmedAt: d.confirmedAt, units: d.units, bloodTypeSnapshot: d.bloodTypeSnapshot };
}
