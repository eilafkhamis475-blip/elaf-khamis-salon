import { describe, expect, it } from "vitest";
import { resolveBookingPayment } from "./bookingPayment";

describe("booking payment updates", () => {
  it("preserves unspecified values and calculates the remaining balance", () => {
    expect(resolveBookingPayment({ totalPrice: 800, depositAmount: 200 }, { depositAmount: 300 })).toEqual({ totalPrice: 800, depositAmount: 300, balance: 500 });
  });

  it("rejects a deposit larger than the total price", () => {
    expect(() => resolveBookingPayment({ totalPrice: 250, depositAmount: 0 }, { depositAmount: 251 })).toThrow("INVALID_PAYMENT_VALUES");
  });
});
