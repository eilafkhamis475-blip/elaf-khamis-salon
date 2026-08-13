import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import * as salonDb from "./db";
import { getAvailableStarts } from "./salonScheduling";
import { buildAdminCsvExport } from "./adminCsvExport";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import {
  checkGoogleCalendarConflict,
  GoogleAppsScriptError,
  isGoogleAppsScriptConfigured,
  synchronizeGoogleBooking,
  type GoogleBookingPayload,
} from "./googleAppsScript";

const bookingStatusSchema = z.enum(["pending", "confirmed", "cancelled", "rescheduled", "completed"]);

function mapBookingError(error: unknown): never {
  const message = error instanceof Error ? error.message : "BOOKING_ERROR";
  const errorMap: Record<string, string> = {
    SERVICE_NOT_FOUND: "الخدمة المختارة لم تعد متاحة.",
    INVALID_SLOT: "هذا الموعد غير صالح أو خارج ساعات عمل الصالون.",
    SLOT_UNAVAILABLE: "تم حجز هذا الموعد للتو. يرجى اختيار وقت متاح آخر.",
    INVALID_COMPANION_COUNT: "عدد المرافقين يجب أن يكون بين 0 و9.",
    STYLIST_REQUIRED: "يرجى اختيار المصففة المناسبة قبل متابعة الحجز.",
    STYLIST_NOT_FOUND: "المصففة المختارة لم تعد متاحة.",
    BOOKING_NOT_FOUND: "تعذر العثور على الحجز المطلوب.",
    GOOGLE_CALENDAR_CONFLICT: "هذا الموعد يتعارض مع جدول خبيرة التصفيف. يرجى اختيار وقت آخر.",
    GOOGLE_SYNC_UNAVAILABLE: "تعذر الاتصال بجدول المواعيد حالياً. يرجى المحاولة بعد قليل.",
    GOOGLE_SYNC_NOT_CONFIGURED: "ربط Google لم يُفعّل بعد من لوحة الإدارة.",
    INVALID_PAYMENT_VALUES: "لا يمكن أن يتجاوز العربون إجمالي قيمة الحجز.",
  };
  throw new TRPCError({
    code: message === "SERVICE_NOT_FOUND" || message === "BOOKING_NOT_FOUND" ? "NOT_FOUND" : "BAD_REQUEST",
    message: errorMap[message] ?? "تعذر إتمام العملية حالياً. يرجى المحاولة مرة أخرى.",
  });
}

function toGooglePayload(booking: NonNullable<Awaited<ReturnType<typeof salonDb.getBookingForGoogleSync>>>): GoogleBookingPayload {
  return {
    reference: booking.reference,
    status: booking.status,
    fullName: booking.fullName,
    phone: booking.phone,
    serviceName: booking.serviceName,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    preparationPlace: booking.preparationPlace ?? booking.area,
    locationUrl: booking.locationUrl,
    companions: booking.companions,
    totalPrice: booking.totalPrice ?? booking.servicePrice,
    deposit: booking.depositAmount ?? 0,
    balance: (booking.totalPrice ?? booking.servicePrice) - (booking.depositAmount ?? 0),
    notes: booking.clientNotes ?? booking.adminNotes,
    calendarEventId: booking.googleCalendarEventId,
  };
}

export async function synchronizeCreatedBookingInBackground(bookingId: number) {
  try {
    const booking = await salonDb.getBookingForGoogleSync(bookingId);
    if (!booking) return;
    const result = await synchronizeGoogleBooking("create", toGooglePayload(booking));
    await salonDb.recordGoogleSyncResult({ bookingId, calendarEventId: result.calendarEventId ?? null });
  } catch (error) {
    const code = error instanceof GoogleAppsScriptError ? error.code : "GOOGLE_SYNC_FAILED";
    try {
      if (code === "CALENDAR_CONFLICT") {
        await salonDb.cancelBookingForGoogleConflict(bookingId);
      } else {
        await salonDb.recordGoogleSyncResult({ bookingId, error: code });
      }
    } catch (persistenceError) {
      console.error("Unable to persist the Google synchronization outcome", persistenceError);
    }
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  booking: router({
    bootstrap: publicProcedure.query(async () => {
      const [services, stylists, settings] = await Promise.all([
        salonDb.listActiveServices(),
        salonDb.listActiveStylists(),
        salonDb.getSalonSettings(),
      ]);
      return { services, stylists, settings };
    }),
    availableSlots: publicProcedure
      .input(z.object({
        serviceId: z.number().int().positive(),
        stylistId: z.number().int().positive().nullable().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }))
      .query(async ({ input }) => {
        const [service, bookedSlotStarts, settings] = await Promise.all([
          salonDb.getServiceById(input.serviceId),
          salonDb.getBookedSlotStarts(input.date, input.stylistId),
          salonDb.getSalonSettings(),
        ]);
        if (!service) throw new TRPCError({ code: "NOT_FOUND", message: "الخدمة المختارة غير متاحة." });
        const starts = getAvailableStarts({
          date: input.date,
          durationMinutes: service.durationMinutes,
          bookedSlotStarts,
          hours: settings,
        });
        return { starts, durationMinutes: service.durationMinutes };
      }),
    create: publicProcedure
      .input(z.object({
        serviceId: z.number().int().positive(),
        stylistId: z.number().int().positive().nullable().optional(),
        startsAt: z.number().int().positive(),
        fullName: z.string().trim().min(5).max(180),
        phone: z.string().trim().min(8).max(32).regex(/^[+0-9\s-]+$/, "رقم الهاتف غير صالح."),
        area: z.string().trim().max(160).nullable().optional(),
        preparationPlace: z.string().trim().max(180).nullable().optional(),
        locationUrl: z.string().trim().url("رابط الموقع الجغرافي غير صالح.").max(500).nullable().optional(),
        clientNotes: z.string().trim().max(1000).nullable().optional(),
        companions: z.number().int().min(0).max(9),
      }))
      .mutation(async ({ input }) => {
        try {
          if (isGoogleAppsScriptConfigured()) {
            const service = await salonDb.getServiceById(input.serviceId);
            if (service) {
              const potentialConflict = await checkGoogleCalendarConflict({
                reference: `CHECK-${input.startsAt}`,
                status: "pending",
                fullName: input.fullName,
                phone: input.phone,
                serviceName: service.name,
                startsAt: input.startsAt,
                endsAt: input.startsAt + service.durationMinutes * 60_000,
                preparationPlace: input.preparationPlace ?? input.area,
                locationUrl: input.locationUrl,
                companions: input.companions,
                totalPrice: service.price,
                deposit: 0,
                balance: service.price,
              });
              if (potentialConflict) throw new Error("GOOGLE_CALENDAR_CONFLICT");
            }
          }
          const created = await salonDb.createBooking(input);
          if (!isGoogleAppsScriptConfigured()) return { ...created, googleSyncStatus: "not_configured" as const };
          void synchronizeCreatedBookingInBackground(created.id);
          return { ...created, googleSyncStatus: "pending" as const };
        } catch (error) {
          return mapBookingError(error);
        }
      }),
    confirmation: publicProcedure
      .input(z.object({ reference: z.string().trim().min(6).max(32) }))
      .query(async ({ input }) => {
        const booking = await salonDb.getBookingByReference(input.reference);
        if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "تعذر العثور على هذا الحجز." });
        return booking;
      }),
  }),
  admin: router({
    summary: adminProcedure.query(() => salonDb.getAdminSummary(Date.now())),
    services: adminProcedure.query(() => salonDb.listAdminServices()),
    stylists: adminProcedure.query(() => salonDb.listAllStylists()),
    createStylist: adminProcedure
      .input(z.object({ name: z.string().trim().min(2).max(160), specialty: z.string().trim().max(160).nullable().optional() }))
      .mutation(({ input }) => salonDb.createStylist(input)),
    updateStylist: adminProcedure
      .input(z.object({
        stylistId: z.number().int().positive(),
        name: z.string().trim().min(2).max(160).optional(),
        specialty: z.string().trim().max(160).nullable().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(({ input }) => salonDb.updateStylist(input)),
    bookings: adminProcedure
      .input(z.object({ from: z.number().int().optional(), to: z.number().int().optional() }).optional())
      .query(({ input }) => salonDb.listAdminBookings(input)),
    finance: adminProcedure
      .input(z.object({ from: z.number().int().optional(), to: z.number().int().optional() }).optional())
      .query(({ input }) => salonDb.getFinanceOverview(input)),
    exportCsv: adminProcedure.mutation(async () => {
      const [bookings, finance] = await Promise.all([
        salonDb.listAdminBookings(),
        salonDb.getFinanceOverview(),
      ]);
      return buildAdminCsvExport({ bookings, ledgerEntries: finance.entries });
    }),
    createExpense: adminProcedure
      .input(z.object({
        amount: z.number().int().positive().max(10_000_000),
        category: z.string().trim().min(2).max(80),
        description: z.string().trim().max(1000).nullable().optional(),
        occurredAt: z.number().int().positive().optional(),
      }))
      .mutation(({ input }) => salonDb.createExpenseEntry(input)),
    voidExpense: adminProcedure
      .input(z.object({ entryId: z.number().int().positive() }))
      .mutation(({ input }) => salonDb.voidExpenseEntry(input.entryId)),
    clients: adminProcedure.query(() => salonDb.listCrmClients()),
    clientHistory: adminProcedure
      .input(z.object({ clientId: z.number().int().positive() }))
      .query(({ input }) => salonDb.listClientAppointmentHistory(input.clientId)),
    activity: adminProcedure
      .input(z.object({ bookingId: z.number().int().positive() }))
      .query(({ input }) => salonDb.listBookingActivity(input.bookingId)),
    settings: adminProcedure.query(() => salonDb.getSalonSettings()),
    reminderSchedule: adminProcedure.query(async () => {
      const settings = await salonDb.getSalonSettings();
      return { enabled: Boolean(settings.reminderScheduleTaskUid), taskUid: settings.reminderScheduleTaskUid };
    }),
    enableReminderSchedule: adminProcedure.mutation(async ({ ctx }) => {
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const settings = await salonDb.getSalonSettings();
      if (settings.reminderScheduleTaskUid) {
        const job = await updateHeartbeatJob(settings.reminderScheduleTaskUid, { enable: true }, sessionToken);
        return { enabled: true, nextExecutionAt: job.nextExecutionAt ?? null };
      }
      const job = await createHeartbeatJob({
        name: "salon-appointment-reminders",
        cron: "0 0 * * * *",
        path: "/api/scheduled/salon-appointment-reminders",
        description: "إشعار إداري بمواعيد صالون إيلاف خميس قبل نحو 24 ساعة.",
      }, sessionToken);
      await salonDb.setReminderScheduleTaskUid(job.taskUid);
      return { enabled: true, nextExecutionAt: job.nextExecutionAt ?? null };
    }),
    pauseReminderSchedule: adminProcedure.mutation(async ({ ctx }) => {
      const settings = await salonDb.getSalonSettings();
      if (!settings.reminderScheduleTaskUid) return { enabled: false, nextExecutionAt: null };
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const job = await updateHeartbeatJob(settings.reminderScheduleTaskUid, { enable: false }, sessionToken);
      return { enabled: false, nextExecutionAt: job.nextExecutionAt ?? null };
    }),
    updateSettings: adminProcedure
      .input(z.object({ cancellationLeadHours: z.number().int().min(0).max(168) }))
      .mutation(({ input }) => salonDb.updateSalonSettings(input)),
    updateBooking: adminProcedure
      .input(z.object({
        bookingId: z.number().int().positive(),
        status: bookingStatusSchema.optional(),
        startsAt: z.number().int().positive().optional(),
        adminNotes: z.string().trim().max(1000).nullable().optional(),
        totalPrice: z.number().int().min(0).max(1_000_000).optional(),
        depositAmount: z.number().int().min(0).max(1_000_000).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          await salonDb.updateBookingByAdmin(input);
          const booking = await salonDb.getBookingForGoogleSync(input.bookingId);
          if (booking && isGoogleAppsScriptConfigured()) {
            try {
              const result = await synchronizeGoogleBooking(input.status === "cancelled" ? "cancel" : "update", toGooglePayload(booking));
              await salonDb.recordGoogleSyncResult({ bookingId: booking.id, calendarEventId: result.calendarEventId ?? booking.googleCalendarEventId });
            } catch (error) {
              const code = error instanceof GoogleAppsScriptError ? error.code : "GOOGLE_SYNC_FAILED";
              await salonDb.recordGoogleSyncResult({ bookingId: booking.id, error: code });
            }
          }
          return { success: true };
        } catch (error) {
          return mapBookingError(error);
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
