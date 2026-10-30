import { describe, it, expect, vi } from "vitest";
import { submitResponse } from "../src/features/donor/respond";
import type { Notification } from "../src/types/api";
const notification = {
  responseStatus: "PENDING",
  bloodRequest: {
    actionable: true,
    status: "OPEN",
    expiresAt: "2099-01-01T00:00:00Z",
  },
} as Notification;
function deps() {
  return {
    refresh: vi.fn().mockResolvedValue(notification),
    consent: vi.fn().mockResolvedValue(true),
    location: vi
      .fn()
      .mockResolvedValue({ type: "Point", coordinates: [-16.6, 13.4] }),
    submit: vi.fn().mockResolvedValue({}),
  };
}
describe("consequential responses", () => {
  it("revalidates and refreshes location before acceptance", async () => {
    const d = deps();
    await submitResponse("ACCEPTED", d);
    expect(d.refresh).toHaveBeenCalledOnce();
    expect(d.submit).toHaveBeenCalledWith({
      status: "ACCEPTED",
      location: { type: "Point", coordinates: [-16.6, 13.4] },
    });
  });
  it("declines without requesting location", async () => {
    const d = deps();
    await submitResponse("DECLINED", d);
    expect(d.location).not.toHaveBeenCalled();
    expect(d.consent).not.toHaveBeenCalled();
    expect(d.submit).toHaveBeenCalledWith({ status: "DECLINED" });
  });
  it("refuses acceptance without explicit existing consent", async () => {
    const d = deps();
    d.consent.mockResolvedValue(false);
    await expect(submitResponse("ACCEPTED", d)).rejects.toThrow(
      "Enable location",
    );
    expect(d.location).not.toHaveBeenCalled();
    expect(d.submit).not.toHaveBeenCalled();
  });
  it("does not fake success after a location failure", async () => {
    const d = deps();
    d.location.mockRejectedValue(new Error("Permission denied"));
    await expect(submitResponse("ACCEPTED", d)).rejects.toThrow(
      "Permission denied",
    );
    expect(d.submit).not.toHaveBeenCalled();
  });
  it("refuses duplicate or closed responses after refresh", async () => {
    const d = deps();
    d.refresh.mockResolvedValue({
      ...notification,
      responseStatus: "ACCEPTED",
    });
    await expect(submitResponse("ACCEPTED", d)).rejects.toThrow();
    expect(d.submit).not.toHaveBeenCalled();
  });
  it("preserves backend rejection", async () => {
    const d = deps();
    d.submit.mockRejectedValue(new Error("No longer eligible"));
    await expect(submitResponse("ACCEPTED", d)).rejects.toThrow(
      "No longer eligible",
    );
  });
});
