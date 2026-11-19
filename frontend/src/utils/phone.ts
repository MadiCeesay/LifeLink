/** Turns what people type ("7001234", "+220 700 1234") into the number we send. */
export function fullPhone(local: string) {
  const t = local.trim();
  const digits = t.replace(/\D/g, "");
  if (t.startsWith("+") || t.startsWith("00") || digits.length > 7) return t;
  return "+220" + digits;
}
