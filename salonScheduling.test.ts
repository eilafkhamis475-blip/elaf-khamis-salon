import { describe, expect, it } from "vitest";
import { getAvailableStarts, getSlotStarts, isValidSalonStart, toSalonTimestamp } from "./salonScheduling";

describe("salon scheduling", () => {
  it("reserves every 30-minute block covered by a two-hour service", () => {
    const start = toSalonTimestamp("2026-08-20", 12 * 60);
    expect(getSlotStarts(start, 120, 30)).toEqual([
      start,
      start + 30 * 60_000,
      start + 60 * 60_000,
      start + 90 * 60_000,
    ]);
  });

  it("hides any start time whose duration overlaps a booked time block", () => {
    const bookedAt = toSalonTimestamp("2026-08-20", 12 * 60 + 30);
    const available = getAvailableStarts({
      date: "2026-08-20",
      durationMinutes: 60,
      bookedSlotStarts: [bookedAt],
    });

    expect(available).not.toContain(toSalonTimestamp("2026-08-20", 12 * 60));
    expect(available).not.toContain(toSalonTimestamp("2026-08-20", 12 * 60 + 30));
    expect(available).toContain(toSalonTimestamp("2026-08-20", 13 * 60));
  });

  it("rejects a booking that would extend beyond closing time", () => {
    expect(isValidSalonStart({
      startsAt: toSalonTimestamp("2026-08-20", 19 * 60),
      durationMinutes: 120,
    })).toBe(false);
  });
});
