import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: vi.fn(),
  hasServicesEnabledAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
  Accuracy: { Balanced: 3 },
}));
import * as Location from "expo-location";
import { devicePoint } from "../src/services/location";
beforeEach(() => vi.resetAllMocks());
describe("foreground device permission", () => {
  it("never retrieves GPS after permission denial", async () => {
    vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
      status: "denied",
    } as never);
    await expect(devicePoint()).rejects.toThrow("permission");
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });
  it("rejects disabled services", async () => {
    vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
      status: "granted",
    } as never);
    vi.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(false);
    await expect(devicePoint()).rejects.toThrow("services");
  });
});
