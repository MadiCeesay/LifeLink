import { describe, it, expect } from "vitest";
import { roleHome, tone, isActiveRequest, toPoint } from "../src/utils/domain";
describe("role destinations", () => {
  it.each([
    ["DONOR", "/(donor)/home"],
    ["FACILITY_USER", "/(facility)/home"],
    ["ADMIN", "/(admin)/overview"],
  ] as const)("%s uses its authenticated experience", (role, path) =>
    expect(roleHome(role)).toBe(path),
  );
});
describe("request and status safety", () => {
  it.each(["FULFILLED", "CANCELLED", "EXPIRED"])("closes %s", (status) =>
    expect(isActiveRequest({ status, expiresAt: "2099-01-01" })).toBe(false),
  );
  it("closes expired open requests", () =>
    expect(isActiveRequest({ status: "OPEN", expiresAt: "2000-01-01" })).toBe(
      false,
    ));
  it("opens a future partial request", () =>
    expect(
      isActiveRequest({ status: "PARTIALLY_FILLED", expiresAt: "2099-01-01" }),
    ).toBe(true));
  it("uses status text semantics", () => {
    expect(tone("CRITICAL")).toBe("danger");
    expect(tone("VERIFIED")).toBe("success");
    expect(tone("UNVERIFIED")).toBe("warning");
    expect(tone("O+")).toBe("neutral");
  });
});
describe("device coordinates", () => {
  it("preserves longitude then latitude", () =>
    expect(toPoint({ longitude: -16.6, latitude: 13.4 }).coordinates).toEqual([
      -16.6, 13.4,
    ]));
  it.each([
    { longitude: NaN, latitude: 0 },
    { longitude: 181, latitude: 13 },
    { longitude: 0, latitude: -91 },
  ])("rejects invalid coordinates", (coords) =>
    expect(() => toPoint(coords)).toThrow(),
  );
});
