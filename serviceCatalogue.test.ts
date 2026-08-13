import { describe, expect, it } from "vitest";
import { INITIAL_SERVICES } from "./db";

describe("initial salon catalogue", () => {
  it("contains only the currently available styling and bridal services with a price and duration", () => {
    expect(INITIAL_SERVICES.map(service => service.category)).toEqual([
      "تسريح",
      "باقة عروس",
    ]);
    expect(INITIAL_SERVICES.find(service => service.code === "styling")?.price).toBe(250);
    for (const service of INITIAL_SERVICES) {
      expect(service.price).toBeGreaterThan(0);
      expect(service.durationMinutes).toBeGreaterThan(0);
    }
  });
});
