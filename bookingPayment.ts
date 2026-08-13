export function resolveBookingPayment(
  current: { totalPrice: number; depositAmount: number },
  input: { totalPrice?: number; depositAmount?: number },
) {
  const totalPrice = input.totalPrice ?? current.totalPrice;
  const depositAmount = input.depositAmount ?? current.depositAmount;
  if (totalPrice < 0 || depositAmount < 0 || depositAmount > totalPrice) {
    throw new Error("INVALID_PAYMENT_VALUES");
  }
  return { totalPrice, depositAmount, balance: totalPrice - depositAmount };
}
