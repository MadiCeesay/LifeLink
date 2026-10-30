import { describe, it, expect } from "vitest";
import { normalizeError } from "../src/services/client";
describe("safe API errors", () => {
  it("does not render unknown raw failures", () =>
    expect(
      normalizeError(new Error("sensitive database string")).message,
    ).not.toContain("sensitive"));
  it("maps permissions clearly", () =>
    expect(
      normalizeError({
        isAxiosError: true,
        response: { status: 403, data: { error: { message: "internal" } } },
      }).message,
    ).toContain("permission"));
  it("maps expiry", () =>
    expect(
      normalizeError({ isAxiosError: true, response: { status: 401 } }).status,
    ).toBe(401));
  it("maps timeouts", () =>
    expect(
      normalizeError({ isAxiosError: true, code: "ECONNABORTED" }).message,
    ).toContain("timed out"));
});
