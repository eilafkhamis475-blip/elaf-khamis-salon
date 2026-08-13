import { notifyOwner } from "./_core/notification";
import * as salonDb from "./db";

const formatAppointment = (timestamp: number) => new Intl.DateTimeFormat("ar-LY", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
}).format(new Date(timestamp));

export async function runSalonReminderJob(taskUid: string) {
  const settings = await salonDb.getSalonSettingsByReminderTaskUid(taskUid);
  if (!settings) return { ok: true, skipped: "orphan" as const, sent: 0 };

  const dueBookings = await salonDb.listBookingsDueForReminder(Date.now());
  let sent = 0;
  for (const booking of dueBookings) {
    const delivered = await notifyOwner({
      title: "تذكير موعد خلال 24 ساعة — صالون إيلاف خميس",
      content: `${booking.fullName} · ${booking.serviceName}\n${formatAppointment(booking.startsAt)}\nالهاتف: ${booking.phone}\nالمرجع: ${booking.reference}`,
    });
    if (!delivered) throw new Error(`OWNER_NOTIFICATION_FAILED:${booking.reference}`);
    await salonDb.markBookingReminderSent(booking.id, Date.now());
    sent += 1;
  }
  return { ok: true, sent };
}
