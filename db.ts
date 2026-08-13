import { and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  bookingEvents,
  bookings,
  bookingSlots,
  clients,
  financeEntries,
  type BookingStatus,
  type InsertUser,
  salonSettings,
  services,
  stylists,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { DEFAULT_SALON_HOURS, getSalonReportingPeriods, getSlotStarts, isValidSalonStart, toSalonTimestamp } from "./salonScheduling";
import { calculateAdminBookingMetrics } from "./adminSummaryMetrics";
import { resolveBookingPayment } from "./bookingPayment";

let _db: ReturnType<typeof drizzle> | null = null;

/** Test-only database override. Production code never calls this helper. */
export function setDatabaseForTesting(database: ReturnType<typeof drizzle> | null) {
  _db = database;
}

export const INITIAL_SERVICES = [
  { code: "styling", name: "تسريح وتصفيف", category: "تسريح", description: "تصفيف أنيق يناسب إطلالتكِ اليومية والمناسبات.", price: 250, durationMinutes: 60 },
  { code: "bridal", name: "باقة العروس", category: "باقة عروس", description: "جلسة متكاملة لإطلالة عروس راقية ومتوازنة.", price: 800, durationMinutes: 240 },
] as const;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function initializeSalonData() {
  const db = await requireDb();
  const existingServices = await db.select({ id: services.id }).from(services).limit(1);
  if (existingServices.length === 0) await db.insert(services).values([...INITIAL_SERVICES]);

  const existingStylists = await db.select({ id: stylists.id }).from(stylists).limit(1);
  if (existingStylists.length === 0) {
    await db.insert(stylists).values({ name: "إيلاف خميس", specialty: "خبيرة شعر", isActive: true });
  }

  const settings = await db.select().from(salonSettings).limit(1);
  if (settings.length === 0) {
    await db.insert(salonSettings).values({
      openingHour: DEFAULT_SALON_HOURS.openingHour,
      closingHour: DEFAULT_SALON_HOURS.closingHour,
      slotIntervalMinutes: DEFAULT_SALON_HOURS.slotIntervalMinutes,
      maximumCompanions: 9,
      cancellationLeadHours: 24,
    });
  }
}

export async function getSalonSettings() {
  await initializeSalonData();
  const db = await requireDb();
  const settings = await db.select().from(salonSettings).limit(1);
  if (!settings[0]) throw new Error("Salon settings unavailable");
  return settings[0];
}

export async function listActiveServices() {
  await initializeSalonData();
  const db = await requireDb();
  return db.select().from(services).where(eq(services.isActive, true)).orderBy(asc(services.id));
}

export async function listActiveStylists() {
  const db = await requireDb();
  return db.select().from(stylists).where(eq(stylists.isActive, true)).orderBy(asc(stylists.name));
}

export async function listAllStylists() {
  const db = await requireDb();
  return db.select().from(stylists).orderBy(asc(stylists.name));
}

export function getBookingSlotKey(stylistId: number | null | undefined, slotStartAt: number) {
  return `resource:${stylistId ?? "salon"}:${slotStartAt}`;
}

export async function getBookedSlotStarts(day: string, stylistId?: number | null) {
  const db = await requireDb();
  const dayStart = toSalonTimestamp(day, 0);
  const nextDay = dayStart + 24 * 60 * 60_000;
  const result = await db
    .select({ startsAt: bookingSlots.slotStartAt, slotKey: bookingSlots.slotKey })
    .from(bookingSlots)
    .where(and(gte(bookingSlots.slotStartAt, dayStart), lt(bookingSlots.slotStartAt, nextDay)));
  const prefix = `resource:${stylistId ?? "salon"}:`;
  return result.filter(row => row.slotKey.startsWith(prefix)).map(row => row.startsAt);
}

export async function getServiceById(serviceId: number) {
  const db = await requireDb();
  const result = await db.select().from(services).where(and(eq(services.id, serviceId), eq(services.isActive, true))).limit(1);
  return result[0];
}

export type PublicBookingInput = {
  serviceId: number;
  stylistId?: number | null;
  startsAt: number;
  fullName: string;
  phone: string;
  area?: string | null;
  preparationPlace?: string | null;
  locationUrl?: string | null;
  clientNotes?: string | null;
  companions: number;
};

function bookingReference() {
  const segment = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `ELAF-${Date.now().toString(36).toUpperCase()}-${segment}`;
}

export async function createBooking(input: PublicBookingInput) {
  await initializeSalonData();
  const db = await requireDb();
  const service = await getServiceById(input.serviceId);
  if (!service) throw new Error("SERVICE_NOT_FOUND");
  const settings = await getSalonSettings();
  const activeStylists = await listActiveStylists();
  if (activeStylists.length > 0 && !input.stylistId) throw new Error("STYLIST_REQUIRED");
  if (input.stylistId && !activeStylists.some(stylist => stylist.id === input.stylistId)) throw new Error("STYLIST_NOT_FOUND");
  const hours = {
    openingHour: settings.openingHour,
    closingHour: settings.closingHour,
    slotIntervalMinutes: settings.slotIntervalMinutes,
  };

  if (input.companions < 0 || input.companions > settings.maximumCompanions) throw new Error("INVALID_COMPANION_COUNT");
  if (!isValidSalonStart({ startsAt: input.startsAt, durationMinutes: service.durationMinutes, hours })) {
    throw new Error("INVALID_SLOT");
  }

  const reservedSlots = getSlotStarts(input.startsAt, service.durationMinutes, settings.slotIntervalMinutes);
  const endsAt = input.startsAt + service.durationMinutes * 60_000;

  try {
    return await db.transaction(async tx => {
      const existingClient = await tx.select().from(clients).where(eq(clients.phone, input.phone)).limit(1);
      let clientId: number;
      if (existingClient[0]) {
        clientId = existingClient[0].id;
        await tx.update(clients).set({ fullName: input.fullName, area: input.area ?? null }).where(eq(clients.id, clientId));
      } else {
        const created = await tx.insert(clients).values({
          fullName: input.fullName,
          phone: input.phone,
          area: input.area ?? null,
        });
        clientId = Number(created[0].insertId);
      }

      const created = await tx.insert(bookings).values({
        reference: bookingReference(),
        clientId,
        serviceId: service.id,
        stylistId: input.stylistId ?? null,
        startsAt: input.startsAt,
        endsAt,
        companions: input.companions,
        preparationPlace: input.preparationPlace ?? input.area ?? "home",
        locationUrl: input.locationUrl ?? null,
        clientNotes: input.clientNotes ?? null,
        totalPrice: service.price,
        depositAmount: 0,
        status: "pending",
      });
      const bookingId = Number(created[0].insertId);

      await tx.insert(bookingSlots).values(reservedSlots.map(slot => ({
        bookingId,
        slotStartAt: slot,
        slotKey: getBookingSlotKey(input.stylistId, slot),
      })));
      await tx.insert(bookingEvents).values({ bookingId, actor: "client", type: "created", note: "تم إنشاء طلب الحجز عبر الموقع." });

      return { id: bookingId, reference: (await tx.select({ reference: bookings.reference }).from(bookings).where(eq(bookings.id, bookingId)).limit(1))[0]!.reference, endsAt };
    });
  } catch (error) {
    if (error instanceof Error && /duplicate|unique|slotKey/i.test(error.message)) throw new Error("SLOT_UNAVAILABLE");
    throw error;
  }
}

export async function getBookingByReference(reference: string) {
  const db = await requireDb();
  const result = await db
    .select({
      id: bookings.id,
      reference: bookings.reference,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      companions: bookings.companions,
      status: bookings.status,
      preparationPlace: bookings.preparationPlace,
      locationUrl: bookings.locationUrl,
      clientNotes: bookings.clientNotes,
      totalPrice: bookings.totalPrice,
      depositAmount: bookings.depositAmount,
      fullName: clients.fullName,
      phone: clients.phone,
      area: clients.area,
      serviceName: services.name,
      serviceDuration: services.durationMinutes,
      servicePrice: services.price,
      stylistName: stylists.name,
    })
    .from(bookings)
    .innerJoin(clients, eq(bookings.clientId, clients.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .leftJoin(stylists, eq(bookings.stylistId, stylists.id))
    .where(eq(bookings.reference, reference))
    .limit(1);
  return result[0];
}

export async function getBookingForGoogleSync(bookingId: number) {
  const db = await requireDb();
  const result = await db
    .select({
      id: bookings.id,
      reference: bookings.reference,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      companions: bookings.companions,
      status: bookings.status,
      adminNotes: bookings.adminNotes,
      preparationPlace: bookings.preparationPlace,
      locationUrl: bookings.locationUrl,
      clientNotes: bookings.clientNotes,
      totalPrice: bookings.totalPrice,
      depositAmount: bookings.depositAmount,
      googleCalendarEventId: bookings.googleCalendarEventId,
      fullName: clients.fullName,
      phone: clients.phone,
      area: clients.area,
      serviceName: services.name,
      servicePrice: services.price,
    })
    .from(bookings)
    .innerJoin(clients, eq(bookings.clientId, clients.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  return result[0];
}

export async function recordGoogleSyncResult(input: { bookingId: number; calendarEventId?: string | null; error?: string | null }) {
  const db = await requireDb();
  const synced = !input.error;
  await db.transaction(async tx => {
    await tx.update(bookings).set({
      ...(input.calendarEventId === undefined ? {} : { googleCalendarEventId: input.calendarEventId }),
      googleSyncStatus: synced ? "synced" : "failed",
      googleSyncError: input.error ?? null,
      googleSyncedAt: synced ? Date.now() : null,
    }).where(eq(bookings.id, input.bookingId));
    await tx.insert(bookingEvents).values({
      bookingId: input.bookingId,
      actor: "system",
      type: synced ? "google_synced" : "google_sync_failed",
      note: synced ? "تمت مزامنة الحجز مع Google Sheets وGoogle Calendar." : input.error ?? "تعذر مزامنة الحجز مع Google.",
    });
  });
}

export async function cancelBookingForGoogleConflict(bookingId: number) {
  const db = await requireDb();
  await db.transaction(async tx => {
    await tx.delete(bookingSlots).where(eq(bookingSlots.bookingId, bookingId));
    await tx.update(bookings).set({
      status: "cancelled",
      googleSyncStatus: "conflict",
      googleSyncError: "CALENDAR_CONFLICT",
    }).where(eq(bookings.id, bookingId));
    await tx.insert(bookingEvents).values({
      bookingId,
      actor: "system",
      type: "google_calendar_conflict",
      note: "أُلغي الحجز تلقائياً لأن Google Calendar أبلغ عن تعارض ضمن هامش ثلاث ساعات.",
    });
  });
}

export async function listAdminBookings({ from, to }: { from?: number; to?: number } = {}) {
  const db = await requireDb();
  const conditions = [];
  if (from !== undefined) conditions.push(gte(bookings.startsAt, from));
  if (to !== undefined) conditions.push(lt(bookings.startsAt, to));
  return db
    .select({
      id: bookings.id,
      reference: bookings.reference,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      companions: bookings.companions,
      status: bookings.status,
      adminNotes: bookings.adminNotes,
      preparationPlace: bookings.preparationPlace,
      locationUrl: bookings.locationUrl,
      clientNotes: bookings.clientNotes,
      totalPrice: bookings.totalPrice,
      depositAmount: bookings.depositAmount,
      fullName: clients.fullName,
      phone: clients.phone,
      area: clients.area,
      serviceId: services.id,
      serviceName: services.name,
      serviceDuration: services.durationMinutes,
      servicePrice: services.price,
      stylistName: stylists.name,
    })
    .from(bookings)
    .innerJoin(clients, eq(bookings.clientId, clients.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .leftJoin(stylists, eq(bookings.stylistId, stylists.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(bookings.startsAt));
}

export async function getAdminSummary(now: number) {
  const db = await requireDb();
  const periods = getSalonReportingPeriods(now);
  const allBookings = await listAdminBookings();
  const active = allBookings.filter(booking => booking.status !== "cancelled");
  const countIn = ({ from, to }: { from: number; to: number }) => active.filter(booking => booking.startsAt >= from && booking.startsAt < to).length;
  const serviceCounts = active.reduce<Record<string, number>>((result, booking) => {
    result[booking.serviceName] = (result[booking.serviceName] ?? 0) + 1;
    return result;
  }, {});
  const topServices = Object.entries(serviceCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
  const metrics = calculateAdminBookingMetrics(allBookings, periods);
  return {
    today: countIn(periods.today),
    week: countIn(periods.week),
    month: countIn(periods.month),
    pending: active.filter(booking => booking.status === "pending").length,
    ...metrics,
    topServices,
  };
}

export async function listCrmClients() {
  const db = await requireDb();
  return db
    .select({
      id: clients.id,
      fullName: clients.fullName,
      phone: clients.phone,
      area: clients.area,
      createdAt: clients.createdAt,
      visits: sql<number>`count(${bookings.id})`,
      lastVisit: sql<number | null>`max(${bookings.startsAt})`,
    })
    .from(clients)
    .leftJoin(bookings, eq(bookings.clientId, clients.id))
    .groupBy(clients.id)
    .orderBy(desc(clients.createdAt));
}

export async function listClientAppointmentHistory(clientId: number) {
  const db = await requireDb();
  return db
    .select({
      id: bookings.id,
      reference: bookings.reference,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      status: bookings.status,
      serviceName: services.name,
    })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(eq(bookings.clientId, clientId))
    .orderBy(desc(bookings.startsAt));
}

export async function listBookingActivity(bookingId: number) {
  const db = await requireDb();
  return db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, bookingId)).orderBy(desc(bookingEvents.createdAt));
}

export async function createStylist(input: { name: string; specialty?: string | null }) {
  const db = await requireDb();
  await db.insert(stylists).values({ name: input.name, specialty: input.specialty ?? null, isActive: true });
  return listActiveStylists();
}

export async function updateStylist(input: { stylistId: number; name?: string; specialty?: string | null; isActive?: boolean }) {
  const db = await requireDb();
  await db.update(stylists).set({
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.specialty === undefined ? {} : { specialty: input.specialty }),
    ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
  }).where(eq(stylists.id, input.stylistId));
  return listAllStylists();
}

export async function listAdminServices() {
  const db = await requireDb();
  return db.select().from(services).orderBy(asc(services.id));
}

export async function updateBookingByAdmin(input: {
  bookingId: number;
  status?: BookingStatus;
  startsAt?: number;
  adminNotes?: string | null;
  totalPrice?: number;
  depositAmount?: number;
}) {
  const db = await requireDb();
  const existing = await db.select().from(bookings).where(eq(bookings.id, input.bookingId)).limit(1);
  const booking = existing[0];
  if (!booking) throw new Error("BOOKING_NOT_FOUND");

  const service = await getServiceById(booking.serviceId);
  if (!service) throw new Error("SERVICE_NOT_FOUND");
  const settings = await getSalonSettings();
  const rescheduling = input.startsAt !== undefined && input.startsAt !== booking.startsAt;
  const cancels = input.status === "cancelled";
  const nextStatus = input.status ?? (rescheduling ? "rescheduled" : booking.status);
  const payment = resolveBookingPayment(booking, input);
  const keepsRecognizedRevenue = nextStatus === "confirmed" || nextStatus === "completed" || (
    nextStatus === "rescheduled" && (booking.status === "confirmed" || booking.status === "completed")
  );

  if (rescheduling && !isValidSalonStart({
    startsAt: input.startsAt!,
    durationMinutes: service.durationMinutes,
    hours: settings,
  })) throw new Error("INVALID_SLOT");

  try {
    await db.transaction(async tx => {
      if (rescheduling || cancels) await tx.delete(bookingSlots).where(eq(bookingSlots.bookingId, booking.id));
      if (rescheduling) {
        const slots = getSlotStarts(input.startsAt!, service.durationMinutes, settings.slotIntervalMinutes);
        await tx.insert(bookingSlots).values(slots.map(slot => ({
          bookingId: booking.id,
          slotStartAt: slot,
          slotKey: getBookingSlotKey(booking.stylistId, slot),
        })));
      }
      await tx.update(bookings).set({
        status: nextStatus,
        startsAt: input.startsAt ?? booking.startsAt,
        endsAt: rescheduling ? input.startsAt! + service.durationMinutes * 60_000 : booking.endsAt,
        adminNotes: input.adminNotes ?? booking.adminNotes,
        totalPrice: payment.totalPrice,
        depositAmount: payment.depositAmount,
      }).where(eq(bookings.id, booking.id));
      await tx.insert(bookingEvents).values({
        bookingId: booking.id,
        actor: "admin",
        type: cancels ? "cancelled" : rescheduling ? "rescheduled" : input.status ?? "updated",
        note: input.adminNotes ?? null,
      });
      const timestamp = Date.now();
      if (cancels) {
        await tx.update(financeEntries).set({
          isVoided: true,
          voidedAt: timestamp,
          voidReason: "أُلغي الحجز، لذا استُبعد إيراده من الإجماليات.",
        }).where(and(
          eq(financeEntries.bookingId, booking.id),
          eq(financeEntries.kind, "income"),
          eq(financeEntries.isVoided, false),
        ));
      } else if (keepsRecognizedRevenue) {
        const amount = payment.totalPrice > 0 ? payment.totalPrice : service.price;
        await tx.insert(financeEntries).values({
          kind: "income",
          amount,
          bookingId: booking.id,
          category: "إيراد حجز",
          description: `إيراد الحجز ${booking.reference} — ${service.name}`,
          occurredAt: timestamp,
          isVoided: false,
        }).onDuplicateKeyUpdate({
          set: {
            amount,
            category: "إيراد حجز",
            description: `إيراد الحجز ${booking.reference} — ${service.name}`,
            isVoided: false,
            voidedAt: null,
            voidReason: null,
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && /duplicate|unique|slotKey/i.test(error.message)) throw new Error("SLOT_UNAVAILABLE");
    throw error;
  }
}

export type FinanceRange = { from?: number; to?: number };

export async function getFinanceOverview({ from, to }: FinanceRange = {}) {
  const db = await requireDb();
  const conditions = [];
  if (from !== undefined) conditions.push(gte(financeEntries.occurredAt, from));
  if (to !== undefined) conditions.push(lt(financeEntries.occurredAt, to));
  const entries = await db.select().from(financeEntries)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(financeEntries.occurredAt), desc(financeEntries.id));
  const activeEntries = entries.filter(entry => !entry.isVoided);
  const income = activeEntries.filter(entry => entry.kind === "income").reduce((total, entry) => total + entry.amount, 0);
  const expense = activeEntries.filter(entry => entry.kind === "expense").reduce((total, entry) => total + entry.amount, 0);
  return { totals: { income, expense, net: income - expense }, entries };
}

export async function createExpenseEntry(input: {
  amount: number;
  category: string;
  description?: string | null;
  occurredAt?: number;
}) {
  const db = await requireDb();
  const created = await db.insert(financeEntries).values({
    kind: "expense",
    amount: input.amount,
    category: input.category,
    description: input.description ?? null,
    occurredAt: input.occurredAt ?? Date.now(),
    isVoided: false,
  });
  return Number(created[0].insertId);
}

export async function voidExpenseEntry(entryId: number) {
  const db = await requireDb();
  await db.update(financeEntries).set({
    isVoided: true,
    voidedAt: Date.now(),
    voidReason: "أُلغي المصروف من لوحة الإدارة.",
  }).where(and(
    eq(financeEntries.id, entryId),
    eq(financeEntries.kind, "expense"),
    eq(financeEntries.isVoided, false),
  ));
}

export async function updateSalonSettings(input: { cancellationLeadHours: number }) {
  const db = await requireDb();
  const current = await getSalonSettings();
  await db.update(salonSettings).set({ cancellationLeadHours: input.cancellationLeadHours }).where(eq(salonSettings.id, current.id));
  return getSalonSettings();
}

export async function getSalonSettingsByReminderTaskUid(taskUid: string) {
  const db = await requireDb();
  const settings = await db.select().from(salonSettings).where(eq(salonSettings.reminderScheduleTaskUid, taskUid)).limit(1);
  return settings[0];
}

export async function setReminderScheduleTaskUid(taskUid: string | null) {
  const db = await requireDb();
  const current = await getSalonSettings();
  await db.update(salonSettings).set({ reminderScheduleTaskUid: taskUid }).where(eq(salonSettings.id, current.id));
  return getSalonSettings();
}

export async function listBookingsDueForReminder(now: number) {
  const db = await requireDb();
  const earliest = now + 23 * 60 * 60_000;
  const latest = now + 25 * 60 * 60_000;
  return db.select({
    id: bookings.id,
    reference: bookings.reference,
    startsAt: bookings.startsAt,
    fullName: clients.fullName,
    phone: clients.phone,
    area: clients.area,
    serviceName: services.name,
  })
    .from(bookings)
    .innerJoin(clients, eq(bookings.clientId, clients.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(and(
      isNull(bookings.reminderMarkedAt),
      gte(bookings.startsAt, earliest),
      lt(bookings.startsAt, latest),
      sql`${bookings.status} in ('pending', 'confirmed', 'rescheduled')`,
    ))
    .orderBy(asc(bookings.startsAt));
}

export async function markBookingReminderSent(bookingId: number, markedAt: number) {
  const db = await requireDb();
  await db.transaction(async tx => {
    await tx.update(bookings).set({ reminderMarkedAt: markedAt }).where(and(eq(bookings.id, bookingId), isNull(bookings.reminderMarkedAt)));
    await tx.insert(bookingEvents).values({ bookingId, actor: "system", type: "reminder_sent", note: "تم إرسال تذكير داخلي قبل الموعد بحوالي 24 ساعة." });
  });
}
