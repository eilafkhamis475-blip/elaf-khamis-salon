import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { resolveBookingPayment } from "./bookingPayment";

const mocks = vi.hoisted(() => ({
  updateBookingByAdmin: vi.fn(),
  getBookingForGoogleSync: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  updateBookingByAdmin: mocks.updateBookingByAdmin,
  getBookingForGoogleSync: mocks.getBookingForGoogleSync,
}));

vi.mock("./googleAppsScript", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./googleAppsScript")>()),
  isGoogleAppsScriptConfigured: () => false,
}));

import { appRouter } from "./routers";

function createAdminContext(): TrpcContext {
  return {
    user: { id: 1, openId: "owner", email: "owner@example.com", name: "صالون إيلاف خميس", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("admin.updateBooking payment flow", () => {
  beforeEach(() => {
    mocks.updateBookingByAdmin.mockReset().mockResolvedValue(undefined);
    mocks.getBookingForGoogleSync.mockReset().mockResolvedValue(undefined);
  });

  it("forwards total price and deposit for persistence, yielding the expected balance and revenue value", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.admin.updateBooking({ bookingId: 12, totalPrice: 800, depositAmount: 250 })).resolves.toEqual({ success: true });
    expect(mocks.updateBookingByAdmin).toHaveBeenCalledWith({ bookingId: 12, totalPrice: 800, depositAmount: 250 });
    expect(resolveBookingPayment({ totalPrice: 800, depositAmount: 0 }, { totalPrice: 800, depositAmount: 250 })).toEqual({ totalPrice: 800, depositAmount: 250, balance: 550 });
  });

  it("rejects a deposit greater than the booking total through the persistence domain guard", () => {
    expect(() => resolveBookingPayment({ totalPrice: 250, depositAmount: 0 }, { totalPrice: 250, depositAmount: 251 })).toThrow("INVALID_PAYMENT_VALUES");
  });

  it("returns the payment validation error through the real admin procedure contract", async () => {
    mocks.updateBookingByAdmin.mockImplementation(async (input) => {
      resolveBookingPayment({ totalPrice: 250, depositAmount: 0 }, input);
    });
    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.admin.updateBooking({ bookingId: 12, totalPrice: 250, depositAmount: 251 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "لا يمكن أن يتجاوز العربون إجمالي قيمة الحجز.",
    });
  });
});
