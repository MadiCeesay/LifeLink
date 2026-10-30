export const bloodTypes = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
] as const;
export const permissions = [
  "VERIFY_DONORS",
  "CREATE_BLOOD_REQUESTS",
  "MANAGE_BLOOD_REQUESTS",
  "CONFIRM_DONATIONS",
] as const;
export type Role = "DONOR" | "FACILITY_USER" | "ADMIN";
export const roleHome = (role: Role) =>
  role === "DONOR"
    ? "/(donor)/home"
    : role === "FACILITY_USER"
      ? "/(facility)/home"
      : "/(admin)/overview";
export const label = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (s) => s.toUpperCase());
export function tone(value: string) {
  if (
    ["VERIFIED", "AVAILABLE", "FULFILLED", "ACCEPTED", "APPROVED"].includes(
      value,
    )
  )
    return "success";
  if (["CRITICAL", "CANCELLED", "SUSPENDED", "REJECTED"].includes(value))
    return "danger";
  if (
    [
      "PENDING",
      "UNVERIFIED",
      "URGENT",
      "REQUIRES_REVERIFICATION",
      "EXPIRED",
    ].includes(value)
  )
    return "warning";
  return "neutral";
}
export const isActiveRequest = (r: { status: string; expiresAt: string }) =>
  ["OPEN", "PARTIALLY_FILLED"].includes(r.status) &&
  Date.parse(r.expiresAt) > Date.now();
export function toPoint(coords: { longitude: number; latitude: number }) {
  const { longitude, latitude } = coords;
  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    Math.abs(longitude) > 180 ||
    Math.abs(latitude) > 90
  )
    throw new Error(
      "Your device returned an invalid location. Please try again.",
    );
  return {
    type: "Point" as const,
    coordinates: [longitude, latitude] as [number, number],
  };
}
export const safetyCopy =
  "Accepting means you are willing to respond. Final donor screening is performed by the healthcare facility.";
export function dateText(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "Not recorded";
}
