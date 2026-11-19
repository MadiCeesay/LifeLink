import { describe, it, expect } from "vitest";
import { registrationSchema } from "../src/features/auth/schemas";
import {
  contractSchema,
  type Contract,
} from "../src/features/operations/schema";
import contracts from "../src/constants/contracts.json";
describe("public registration", () => {
  const valid = {
    name: "Test Person",
    email: "test@example.invalid",
    phone: "+220 1234567",
    password: "a-strong-password",
  };
  it("accepts supported identity only", () =>
    expect(registrationSchema.parse(valid)).toEqual(valid));
  it("rejects short passwords", () =>
    expect(
      registrationSchema.safeParse({ ...valid, password: "short" }).success,
    ).toBe(false));
  it("rejects too many phone digits", () =>
    expect(
      registrationSchema.safeParse({ ...valid, phone: "1234567890123456" })
        .success,
    ).toBe(false));
  it("does not submit a public admin role", () =>
    expect(
      registrationSchema.parse({ ...valid, role: "ADMIN" }),
    ).not.toHaveProperty("role"));
  it("rejects passwords beyond bcrypt byte limit", () =>
    expect(
      registrationSchema.safeParse({ ...valid, password: "é".repeat(40) })
        .success,
    ).toBe(false));
});
describe("operational forms", () => {
  const request = contractSchema(contracts.RequestCreate as Contract);
  it("parses unit inputs and preserves backend field names", () =>
    expect(
      request.parse({
        patientBloodType: "O+",
        unitsNeeded: "2",
        urgency: "URGENT",
        expiresAt: "2099-01-01T10:00:00Z",
      }),
    ).toMatchObject({ unitsNeeded: 2 }));
  it("rejects unsupported urgency and units", () =>
    expect(
      request.safeParse({
        patientBloodType: "O+",
        unitsNeeded: "0",
        urgency: "EMERGENCY",
        expiresAt: "tomorrow",
      }).success,
    ).toBe(false));
  it("rejects extra patient data", () =>
    expect(
      request.safeParse({
        patientBloodType: "O+",
        unitsNeeded: "2",
        urgency: "URGENT",
        expiresAt: "2099-01-01T10:00:00Z",
        diagnosis: "private",
      }).success,
    ).toBe(false));
  it("rejects duplicate permissions", () =>
    expect(
      contractSchema(contracts.PermissionsInput as Contract).safeParse({
        permissions: ["VERIFY_DONORS", "VERIFY_DONORS"],
      }).success,
    ).toBe(false));
});
describe("phone entry", async () => {
  const { fullPhone } = await import("./phone-helper");
  it("adds +220 to local Gambian numbers", () => {
    expect(fullPhone("7001234")).toBe("+2207001234");
    expect(fullPhone("700 1234")).toBe("+2207001234");
  });
  it("keeps numbers that already have a country code", () => {
    expect(fullPhone("+221 77 123 4567")).toBe("+221 77 123 4567");
    expect(fullPhone("2207001234")).toBe("2207001234");
  });
});
describe("donor QR codes", async () => {
  const { qrValue, parseDonorCode } = await import("../src/utils/qr");
  const id = "65a1b2c3d4e5f60718293a4b";
  it("round-trips the donor id", () => expect(parseDonorCode(qrValue(id))).toBe(id));
  it("accepts a pasted id and rejects other codes", () => {
    expect(parseDonorCode(" " + id.toUpperCase() + " ")).toBe(id);
    expect(parseDonorCode("https://example.com")).toBeNull();
  });
});
