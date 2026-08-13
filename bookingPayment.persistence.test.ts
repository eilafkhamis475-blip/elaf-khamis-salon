import { afterEach, describe, expect, it } from "vitest";
import { bookings, financeEntries, salonSettings, services, stylists } from "../drizzle/schema";
import { setDatabaseForTesting, updateBookingByAdmin } from "./db";

type Store = {
  booking: Record<string, unknown>;
  service: Record<string, unknown>;
  settings: Record<string, unknown>;
  stylist: Record<string, unknown>;
  bookingUpdates: Record<string, unknown>[];
  ledgerUpserts: Record<string, unknown>[];
};

function makeDatabase(store: Store) {
  const rowsFor = (table: unknown) => {
    if (table === bookings) return [store.booking];
    if (table === services) return [store.service];
    if (table === salonSettings) return [store.settings];
    if (table === stylists) return [store.stylist];
    return [];
  };

  const database = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({ limit: async (count: number) => rowsFor(table).slice(0, count), orderBy: async () => rowsFor(table) }),
        limit: async (count: number) => rowsFor(table).slice(0, count),
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          if (table === bookings) store.bookingUpdates.push(values);
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        if (table === financeEntries) store.ledgerUpserts.push(values);
        return { onDuplicateKeyUpdate: async () => undefined };
      },
    }),
    delete: () => ({ where: async () => undefined }),
    transaction: async (callback: (transaction: ReturnType<typeof makeDatabase>) => Promise<void>) => callback(database as ReturnType<typeof makeDatabase>),
  };
  return database;
}

function makeStore(): Store {
  return {
    booking: { id: 12, serviceId: 2, stylistId: 1, startsAt: 1_786_000_000_000, endsAt: 1_786_000_240_000, status: "confirmed", totalPrice: 250, depositAmount: 0, reference: "ELAF-12", adminNotes: null },
    service: { id: 2, name: "باقة العروس", price: 800, durationMinutes: 240 },
    settings: { id: 1, openingHour: 10, closingHour: 20, slotIntervalMinutes: 30 },
    stylist: { id: 1, name: "إيلاف خميس", isActive: true },
    bookingUpdates: [],
    ledgerUpserts: [],
  };
}

afterEach(() => setDatabaseForTesting(null));

describe("updateBookingByAdmin payment persistence", () => {
  it("persists the revised total and deposit, and upserts linked recognized revenue", async () => {
    const store = makeStore();
    setDatabaseForTesting(makeDatabase(store) as never);

    await updateBookingByAdmin({ bookingId: 12, totalPrice: 800, depositAmount: 250 });

    expect(store.bookingUpdates).toContainEqual(expect.objectContaining({ totalPrice: 800, depositAmount: 250 }));
    expect(800 - 250).toBe(550);
    expect(store.ledgerUpserts).toContainEqual(expect.objectContaining({ kind: "income", amount: 800, bookingId: 12, isVoided: false }));
  });

  it("rejects an excessive deposit before persisting a booking or ledger update", async () => {
    const store = makeStore();
    setDatabaseForTesting(makeDatabase(store) as never);

    await expect(updateBookingByAdmin({ bookingId: 12, totalPrice: 250, depositAmount: 251 })).rejects.toThrow("INVALID_PAYMENT_VALUES");
    expect(store.bookingUpdates).toHaveLength(0);
    expect(store.ledgerUpserts).toHaveLength(0);
  });
});
