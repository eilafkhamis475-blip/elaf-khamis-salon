export type SalonHours = {
  openingHour: number;
  closingHour: number;
  slotIntervalMinutes: number;
};

export const DEFAULT_SALON_HOURS: SalonHours = {
  openingHour: 10,
  closingHour: 20,
  slotIntervalMinutes: 30,
};

const SALON_UTC_OFFSET = "+02:00";
const SALON_OFFSET_MS = 2 * 60 * 60_000;

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function toSalonTimestamp(date: string, minutesAfterMidnight: number): number {
  if (!isDateKey(date) || minutesAfterMidnight < 0 || minutesAfterMidnight >= 24 * 60) {
    throw new Error("Invalid salon date or time");
  }

  const hour = Math.floor(minutesAfterMidnight / 60).toString().padStart(2, "0");
  const minute = (minutesAfterMidnight % 60).toString().padStart(2, "0");
  return new Date(`${date}T${hour}:${minute}:00${SALON_UTC_OFFSET}`).getTime();
}

function salonDateKey(timestamp: number) {
  const salonDate = new Date(timestamp + SALON_OFFSET_MS);
  const year = salonDate.getUTCFullYear();
  const month = String(salonDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(salonDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addSalonDays(date: string, days: number) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function nextSalonMonthStart(date: string) {
  const [year, month] = date.slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

/** Calculates reporting boundaries in the salon's fixed Tripoli (+02:00) business time. */
export function getSalonReportingPeriods(now: number) {
  const today = salonDateKey(now);
  const salonNow = new Date(now + SALON_OFFSET_MS);
  const daysSinceSaturday = (salonNow.getUTCDay() + 1) % 7;
  const weekStart = addSalonDays(today, -daysSinceSaturday);
  const monthStart = `${today.slice(0, 7)}-01`;
  const period = (start: string, end: string) => ({ from: toSalonTimestamp(start, 0), to: toSalonTimestamp(end, 0) });

  return {
    today: period(today, addSalonDays(today, 1)),
    week: period(weekStart, addSalonDays(weekStart, 7)),
    month: period(monthStart, nextSalonMonthStart(monthStart)),
  };
}

export function getSlotStarts(startsAt: number, durationMinutes: number, slotIntervalMinutes: number): number[] {
  if (durationMinutes <= 0 || slotIntervalMinutes <= 0 || durationMinutes % slotIntervalMinutes !== 0) {
    throw new Error("Service duration must be a positive multiple of the booking interval");
  }

  return Array.from(
    { length: durationMinutes / slotIntervalMinutes },
    (_, index) => startsAt + index * slotIntervalMinutes * 60_000,
  );
}

export function getAvailableStarts({
  date,
  durationMinutes,
  bookedSlotStarts,
  hours = DEFAULT_SALON_HOURS,
}: {
  date: string;
  durationMinutes: number;
  bookedSlotStarts: number[];
  hours?: SalonHours;
}): number[] {
  if (!isDateKey(date) || durationMinutes <= 0 || durationMinutes % hours.slotIntervalMinutes !== 0) {
    return [];
  }

  const booked = new Set(bookedSlotStarts);
  const openingMinutes = hours.openingHour * 60;
  const closingMinutes = hours.closingHour * 60;
  const latestStart = closingMinutes - durationMinutes;
  const starts: number[] = [];

  for (let minute = openingMinutes; minute <= latestStart; minute += hours.slotIntervalMinutes) {
    const startsAt = toSalonTimestamp(date, minute);
    const occupied = getSlotStarts(startsAt, durationMinutes, hours.slotIntervalMinutes).some(slot => booked.has(slot));
    if (!occupied) starts.push(startsAt);
  }

  return starts;
}

export function isValidSalonStart({
  startsAt,
  durationMinutes,
  hours = DEFAULT_SALON_HOURS,
}: {
  startsAt: number;
  durationMinutes: number;
  hours?: SalonHours;
}): boolean {
  if (!Number.isSafeInteger(startsAt) || durationMinutes <= 0 || durationMinutes % hours.slotIntervalMinutes !== 0) {
    return false;
  }

  const local = new Date(startsAt + 2 * 60 * 60_000);
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const alignsToSlot = minutes % hours.slotIntervalMinutes === 0;
  const withinDay = minutes >= hours.openingHour * 60;
  const endsByClosing = minutes + durationMinutes <= hours.closingHour * 60;
  return alignsToSlot && withinDay && endsByClosing;
}

export function formatSalonTime(startsAt: number): string {
  return new Intl.DateTimeFormat("ar-LY", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Tripoli",
  }).format(new Date(startsAt));
}
