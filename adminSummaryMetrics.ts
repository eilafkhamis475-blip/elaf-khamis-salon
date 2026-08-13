export type SummaryBookingMetricInput = {
  status: string;
  startsAt: number;
  totalPrice: number | null;
  depositAmount: number | null;
};

export function calculateAdminBookingMetrics(
  bookings: SummaryBookingMetricInput[],
  periods: { today: { from: number; to: number } },
) {
  const active = bookings.filter((booking) => booking.status !== "cancelled");
  const tomorrow = { from: periods.today.to, to: periods.today.to + 24 * 60 * 60 * 1000 };
  const completedOrConfirmed = active.filter((booking) => booking.status === "confirmed" || booking.status === "completed");

  return {
    tomorrow: active.filter((booking) => booking.startsAt >= tomorrow.from && booking.startsAt < tomorrow.to).length,
    collectedDeposits: completedOrConfirmed.reduce((total, booking) => total + (booking.depositAmount ?? 0), 0),
    outstandingBalance: completedOrConfirmed.reduce(
      (total, booking) => total + Math.max(0, (booking.totalPrice ?? 0) - (booking.depositAmount ?? 0)),
      0,
    ),
  };
}
