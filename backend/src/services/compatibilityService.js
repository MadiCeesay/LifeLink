import { bloodTypeSchema, compatibilityPairSchema } from '../validators/matching.js';
import { parseInput } from '../utils/parseInput.js';
// Simplified red-cell candidate coordination only; never clinical clearance.
const compatibleDonors = Object.freeze(Object.fromEntries(Object.entries({
  'O-': ['O-'],
  'O+': ['O-', 'O+'],
  'A-': ['O-', 'A-'],
  'A+': ['O-', 'O+', 'A-', 'A+'],
  'B-': ['O-', 'B-'],
  'B+': ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
}).map(([recipient, donors]) => [recipient, Object.freeze(donors)])));
export function getCompatibleDonorBloodTypes(recipientBloodType) {
  const recipient = parseInput(bloodTypeSchema, recipientBloodType, 'recipient blood type');
  return [...compatibleDonors[recipient]];
}
export function isBloodTypeCompatible(input) {
  const { donorBloodType, recipientBloodType } = parseInput(compatibilityPairSchema, input, 'compatibility pair');
  const donor = parseInput(bloodTypeSchema, donorBloodType, 'donor blood type');
  return getCompatibleDonorBloodTypes(recipientBloodType).includes(donor);
}
