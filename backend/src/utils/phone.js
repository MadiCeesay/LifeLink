// Normalizes phone numbers to a comparable key such as "+2207001234".
// Gambian numbers are 7 digits locally; the 220 country code is added when missing.
export function phoneKey(input) {
  if (typeof input !== 'string') return undefined;
  let digits = input.replace(/\D/g, '');
  if (input.trim().startsWith('00')) digits = digits.slice(2);
  if (digits.length === 7) digits = '220' + digits;
  return digits.length >= 7 && digits.length <= 15 ? '+' + digits : undefined;
}
