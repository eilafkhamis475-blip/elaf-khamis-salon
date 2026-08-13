import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as salonDb from "./db";
import * as googleAppsScript from "./googleAppsScript";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("booking input validation", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects a companion count above the salon limit before a booking is saved", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.booking.create({
      serviceId: 1,
      stylistId: 1,
      startsAt: Date.now() + 86_400_000,
      fullName: "عميلة اختبار",
      phone: "0922119292",
      companions: 10,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("returns a unique reference after the controlled booking persistence succeeds", async () => {
    vi.spyOn(googleAppsScript, "isGoogleAppsScriptConfigured").mockReturnValue(false);
    const createBooking = vi.spyOn(salonDb, "createBooking").mockResolvedValue({
      id: 42,
      reference: "ELAF-TEST-REF",
      endsAt: Date.now() + 120 * 60_000,
    });
    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.booking.create({
      serviceId: 1,
      stylistId: 1,
      startsAt: Date.now() + 86_400_000,
      fullName: "عميلة اختبار",
      phone: "0922119292",
      preparationPlace: "صالة أفراح في حي الأندلس",
      locationUrl: "https://maps.google.com/?q=32.8872,13.1913",
      clientNotes: "التجهيز لعروس مع مرافقات.",
      companions: 2,
    })).resolves.toMatchObject({ reference: "ELAF-TEST-REF" });
    expect(createBooking).toHaveBeenCalledWith(expect.objectContaining({
      companions: 2,
      phone: "0922119292",
      preparationPlace: "صالة أفراح في حي الأندلس",
      locationUrl: "https://maps.google.com/?q=32.8872,13.1913",
      clientNotes: "التجهيز لعروس مع مرافقات.",
    }));
  });
});
