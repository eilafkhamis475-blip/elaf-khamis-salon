import { describe, expect, it } from "vitest";
import { getSalonReportingPeriods } from "./salonScheduling";

describe("getSalonReportingPeriods", () => {
  it("uses Tripoli business dates, excludes future days, and starts the week on Saturday", () => {
    const periods = getSalonReportingPeriods(Date.parse("2026-08-13T19:00:00.000Z"));

    expect(periods.today).toEqual({
      from: Date.parse("2026-08-12T22:00:00.000Z"),
      to: Date.parse("2026-08-13T22:00:00.000Z"),
    });
    expect(periods.week).toEqual({
      from: Date.parse("2026-08-07T22:00:00.000Z"),
      to: Date.parse("2026-08-14T22:00:00.000Z"),
    });
    expect(periods.month).toEqual({
      from: Date.parse("2026-07-31T22:00:00.000Z"),
      to: Date.parse("2026-08-31T22:00:00.000Z"),
    });
  });
});
