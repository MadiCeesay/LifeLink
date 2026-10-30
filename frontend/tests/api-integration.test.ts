import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  setupWorkflow,
  fixtures,
  token,
  point,
} from "../../backend/tests/helpers/workflow.js";
import { api, send, setToken } from "../src/services/client";
import type {
  Session,
  User,
  Facility,
  Staff,
  Verification,
  LocationState,
  BloodRequest,
  Broadcast,
  Notification,
  FacilityResponse,
  Donation,
  Stats,
  AuditLog,
} from "../src/types/api";
let context: Awaited<ReturnType<typeof setupWorkflow>>;
let server: import("node:http").Server;
beforeAll(async () => {
  context = await setupWorkflow();
  const f = await fixtures();
  server = context.app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as { port: number };
  process.env.EXPO_PUBLIC_API_URL =
    "http://127.0.0.1:" + address.port + "/api/v1";
  api.defaults.baseURL = process.env.EXPO_PUBLIC_API_URL;
  setToken(token(f.admin));
}, 90000);
afterAll(async () => {
  setToken(null);
  if (server)
    await new Promise<void>((resolve) => server.close(() => resolve()));
  if (context) await context.close();
}, 30000);
describe("frontend HTTP client against isolated real LifeLink API", () => {
  it("completes registration, facility verification, broadcast, response and donation coordination", async () => {
    const adminSession = await send<Session>("post", "/auth/login", {
      email: "admin@example.com",
      password: "test-only-password-123",
    });
    setToken(null);
    const session = await send<Session>("post", "/auth/register", {
      name: "Integration Donor",
      email: "mobile-donor@example.invalid",
      phone: "+220 300 4444",
      password: "test-only-password-123",
    });
    const donorId = session.user.id;
    setToken(session.accessToken);
    expect((await send<{ user: User }>("get", "/auth/me")).user.role).toBe(
      "DONOR",
    );
    expect(
      (await send<Verification>("get", "/donors/me/verification"))
        .verificationStatus,
    ).toBe("UNVERIFIED");
    setToken(adminSession.accessToken);
    const facility = await send<Facility>("post", "/admin/facilities", {
      name: "Integration Facility",
      facilityType: "HEALTH_CENTRE",
      phone: "+220 300 5555",
      email: "mobile-facility@example.invalid",
      address: "Disposable integration facility",
    });
    await send("patch", "/admin/facilities/" + facility.id + "/approve", {
      reason: "Integration test approval",
    });
    await send("put", "/admin/facilities/" + facility.id + "/location", point);
    const staff = await send<Staff>(
      "post",
      "/admin/facilities/" + facility.id + "/staff",
      {
        name: "Integration Staff",
        email: "mobile-staff@example.invalid",
        phone: "+220 300 6666",
        password: "test-only-password-123",
        permissions: [
          "VERIFY_DONORS",
          "CREATE_BLOOD_REQUESTS",
          "MANAGE_BLOOD_REQUESTS",
          "CONFIRM_DONATIONS",
        ],
      },
    );
    expect(staff.role).toBe("FACILITY_USER");
    setToken(null);
    const staffSession = await send<Session>("post", "/auth/login", {
      email: "mobile-staff@example.invalid",
      password: "test-only-password-123",
    });
    setToken(staffSession.accessToken);
    expect((await send<Facility>("get", "/facilities/me")).id).toBe(
      facility.id,
    );
    await send("patch", "/donors/" + donorId + "/verification", {
      verifiedBloodType: "O-",
    });
    setToken(session.accessToken);
    expect(
      (
        await send<LocationState>("patch", "/donors/me/availability", {
          availabilityStatus: "AVAILABLE",
        })
      ).availabilityStatus,
    ).toBe("AVAILABLE");
    await send("patch", "/donors/me/location-sharing", {
      locationSharingEnabled: true,
    });
    await send("put", "/donors/me/location", point);
    setToken(staffSession.accessToken);
    const request = await send<BloodRequest>("post", "/requests", {
      patientBloodType: "O+",
      unitsNeeded: 1,
      urgency: "URGENT",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    const key = randomUUID();
    const broadcast = await send<Broadcast>(
      "post",
      "/requests/" + request.id + "/broadcast",
      { idempotencyKey: key },
    );
    expect(broadcast.notifiedCount).toBeGreaterThan(0);
    expect(
      (
        await send<Broadcast>(
          "post",
          "/requests/" + request.id + "/broadcast",
          { idempotencyKey: key },
        )
      ).id,
    ).toBe(broadcast.id);
    setToken(session.accessToken);
    const inbox = await send<{ notifications: Notification[] }>(
      "get",
      "/notifications",
    );
    const notification = inbox.notifications.find(
      (n) => n.bloodRequest?.id === request.id,
    )!;
    expect(notification.responseStatus).toBe("PENDING");
    expect(notification.bloodRequest).not.toHaveProperty("requestLocation");
    await send("patch", "/notifications/" + notification.id + "/read", {});
    await send("post", "/notifications/" + notification.id + "/response", {
      status: "ACCEPTED",
      location: point,
    });
    expect(
      (
        await send<{ notifications: Notification[] }>("get", "/notifications")
      ).notifications.find((n) => n.id === notification.id)?.responseStatus,
    ).toBe("ACCEPTED");
    setToken(staffSession.accessToken);
    const responses = await send<{ responses: FacilityResponse[] }>(
      "get",
      "/requests/" + request.id + "/responses",
    );
    expect(responses.responses[0].donor?.id).toBe(donorId);
    expect(responses.responses[0].donor).not.toHaveProperty("currentLocation");
    const donation = await send<Donation>(
      "post",
      "/requests/" + request.id + "/donations",
      { donorId, units: 1 },
    );
    expect(donation.units).toBe(1);
    expect(
      (await send<BloodRequest>("get", "/requests/" + request.id)).status,
    ).toBe("FULFILLED");
    setToken(session.accessToken);
    expect(
      (await send<{ donations: Donation[] }>("get", "/donors/me/donations"))
        .donations[0].id,
    ).toBe(donation.id);
    await expect(send("get", "/admin/stats")).rejects.toMatchObject({
      status: 403,
    });
    setToken(adminSession.accessToken);
    expect(
      (await send<Stats>("get", "/admin/stats")).confirmedDonations,
    ).toBeGreaterThan(0);
    expect(
      (await send<{ auditLogs: AuditLog[] }>("get", "/admin/audit-logs"))
        .auditLogs.length,
    ).toBeGreaterThan(0);
  }, 60000);
});
