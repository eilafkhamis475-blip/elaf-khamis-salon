import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ createBooking: vi.fn() }));

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  createBooking: mocks.createBooking,
}));

vi.mock("./googleAppsScript", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./googleAppsScript")>()),
  isGoogleAppsScriptConfigured: () => false,
}));

import { appRouter } from "./routers";

function createPublicContext(): TrpcContext {
  return { user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("public booking submission flow", () => {
  beforeEach(() => mocks.createBooking.mockReset().mockResolvedValue({ id: 101, reference: "ELAF-E2E" }));

  it("accepts the four-step form payload, persists it through the booking service, and returns a reference ready for confirmation", async () => {
    const payload = {
      serviceId: 2,
      stylistId: null,
      startsAt: 1_786_000_000_000,
      fullName: "أسماء علي سالم",
      phone: "0922119292",
      area: "طرابلس",
      preparationPlace: "المنزل",
      locationUrl: "https://maps.example.com/location",
      clientNotes: "تجهيز قبل المناسبة",
      companions: 2,
    };
    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.booking.create(payload)).resolves.toEqual({ id: 101, reference: "ELAF-E2E", googleSyncStatus: "not_configured" });
    expect(mocks.createBooking).toHaveBeenCalledWith(payload);
  });

  it("rejects an excessive companion count before any persistence attempt", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.booking.create({ serviceId: 2, startsAt: 1_786_000_000_000, fullName: "أسماء علي سالم", phone: "0922119292", companions: 10 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.createBooking).not.toHaveBeenCalled();
  });
});
