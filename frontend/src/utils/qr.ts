/** Donor QR codes carry only the donor ID, never personal details. */
export const qrValue = (donorId: string) => `lifelink:donor:${donorId}`;
/** Accepts a scanned QR ("lifelink:donor:<id>") or a typed/pasted 24-character ID. */
export function parseDonorCode(raw: string): string | null {
  const v = raw.trim();
  const m = /^lifelink:donor:([a-f0-9]{24})$/i.exec(v) ?? /^([a-f0-9]{24})$/i.exec(v);
  return m ? m[1].toLowerCase() : null;
}
