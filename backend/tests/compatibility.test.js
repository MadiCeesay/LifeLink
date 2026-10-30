import { describe, it, expect } from 'vitest';
import { BLOOD_TYPES } from '../src/config/domain.js';
import { getCompatibleDonorBloodTypes, isBloodTypeCompatible } from '../src/services/compatibilityService.js';
const expected = {
  'O-': ['O-'], 'O+': ['O-', 'O+'], 'A-': ['O-', 'A-'],
  'A+': ['O-', 'O+', 'A-', 'A+'], 'B-': ['O-', 'B-'],
  'B+': ['O-', 'O+', 'B-', 'B+'], 'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
};
describe('complete red-cell candidate compatibility matrix', () => {
  it.each(BLOOD_TYPES.flatMap(recipientBloodType => BLOOD_TYPES.map(donorBloodType => ({ donorBloodType, recipientBloodType }))))('donor $donorBloodType -> recipient $recipientBloodType', pair => {
    expect(isBloodTypeCompatible(pair)).toBe(expected[pair.recipientBloodType].includes(pair.donorBloodType));
  });
  it.each(BLOOD_TYPES)('returns the exact donor group set for recipient %s', recipient => {
    expect(getCompatibleDonorBloodTypes(recipient)).toEqual(expected[recipient]);
  });
  it('distinguishes donor/recipient direction explicitly', () => {
    expect(isBloodTypeCompatible({ donorBloodType: 'O-', recipientBloodType: 'AB+' })).toBe(true);
    expect(isBloodTypeCompatible({ donorBloodType: 'AB+', recipientBloodType: 'O-' })).toBe(false);
  });
  it.each(['UNKNOWN', 'a+', 'AB', '', null, undefined, 1, {}, []])('rejects invalid recipient: %s', recipient => {
    expect(() => getCompatibleDonorBloodTypes(recipient)).toThrow();
    expect(() => isBloodTypeCompatible({ donorBloodType: 'O-', recipientBloodType: recipient })).toThrow();
  });
  it.each(['UNKNOWN', 'o-', '', null, undefined, 1, {}, []])('rejects invalid donor: %s', donor => {
    expect(() => isBloodTypeCompatible({ donorBloodType: donor, recipientBloodType: 'AB+' })).toThrow();
  });
  it('does not allow callers to mutate centralized policy', () => {
    const donors = getCompatibleDonorBloodTypes('O-');
    donors.push('AB+');
    expect(getCompatibleDonorBloodTypes('O-')).toEqual(['O-']);
    expect(Object.keys(expected).sort()).toEqual([...BLOOD_TYPES].sort());
  });
});
