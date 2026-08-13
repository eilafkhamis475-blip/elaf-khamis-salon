import { describe, expect, it } from "vitest";
import { filterBookings, filterClients } from "../client/src/lib/adminSearch";

describe("admin search", () => {
  const bookings = [
    { fullName: "أسماء علي", phone: "0922119292", reference: "ELAF-A1", serviceName: "تسريح وتصفيف", startsAt: Date.parse("2026-08-14T08:00:00.000Z") },
    { fullName: "فاطمة سالم", phone: "0910000000", reference: "ELAF-B2", serviceName: "باقة العروس", startsAt: Date.parse("2026-08-15T10:00:00.000Z") },
  ];

  it("finds bookings by name, phone, reference, service, and ISO date", () => {
    expect(filterBookings(bookings, "أسماء")).toHaveLength(1);
    expect(filterBookings(bookings, "0922119292")).toHaveLength(1);
    expect(filterBookings(bookings, "elaf-b2")).toHaveLength(1);
    expect(filterBookings(bookings, "باقة العروس")).toHaveLength(1);
    expect(filterBookings(bookings, "2026-08-14")).toHaveLength(1);
  });

  it("filters client records by name or phone", () => {
    const clients = bookings.map(({ fullName, phone }) => ({ fullName, phone }));
    expect(filterClients(clients, "فاطمة")).toEqual([clients[1]]);
    expect(filterClients(clients, "0922119292")).toEqual([clients[0]]);
  });
});
