import { describe, it, expect, vi } from "vitest";
import { establishSession, clearSession } from "../src/services/session";
function ports() {
  return {
    authenticate: vi.fn().mockResolvedValue({
      accessToken: "test-only-token",
      user: { role: "ADMIN" },
    }),
    identify: vi
      .fn()
      .mockResolvedValue({ user: { id: "account", role: "DONOR" } }),
    write: vi.fn().mockResolvedValue(undefined),
    erase: vi.fn().mockResolvedValue(undefined),
    attach: vi.fn(),
    clearCache: vi.fn().mockResolvedValue(undefined),
  };
}
describe("session lifecycle", () => {
  it("uses fresh authenticated identity instead of role selection", async () => {
    const p = ports();
    const user = await establishSession("login", {}, p);
    expect(user.role).toBe("DONOR");
    expect(p.clearCache).toHaveBeenCalledOnce();
    expect(p.write).toHaveBeenCalledWith("test-only-token");
  });
  it("does not preserve a failed session", async () => {
    const p = ports();
    p.identify.mockRejectedValue(new Error("Expired"));
    await expect(establishSession("login", {}, p)).rejects.toThrow("Expired");
    expect(p.write).not.toHaveBeenCalled();
    expect(p.attach).toHaveBeenLastCalledWith(null);
    expect(p.erase).toHaveBeenCalledTimes(2);
  });
  it("logout clears cache and credentials", async () => {
    const p = ports();
    await clearSession(p);
    expect(p.attach).toHaveBeenCalledWith(null);
    expect(p.clearCache).toHaveBeenCalledOnce();
    expect(p.erase).toHaveBeenCalledOnce();
  });
});
