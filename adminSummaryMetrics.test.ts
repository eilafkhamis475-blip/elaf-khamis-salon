import { describe, expect, it } from "vitest";
import { calculateAdminBookingMetrics } from "./adminSummaryMetrics";

describe("administrative booking financial metrics", () => {
  it("counts tomorrow bookings and sums deposits and remaining balances from confirmed work only", () => {
    const startOfTomorrow = 1_800_086_400_000;
    const metrics = calculateAdminBookingMetrics([
      { status: "confirmed", startsAt: startOfTomorrow + 3_600_000, totalPrice: 800, depositAmount: 250 },
      { status: "completed", startsAt: startOfTomorrow + 7_200_000, totalPrice: 250, depositAmount: 250 },
      { status: "pending", startsAt: startOfTomorrow + 10_800_000, totalPrice: 800, depositAmount: 100 },
      { status: "cancelled", startsAt: startOfTomorrow + 14_400_000, totalPrice: 250, depositAmount: 250 },
    ], { today: { from: 1_800_000_000_000, to: startOfTomorrow } });

    expect(metrics).toEqual({ tomorrow: 3, collectedDeposits: 500, outstandingBalance: 550 });
  });
});
