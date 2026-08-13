import { afterEach, describe, expect, it, vi } from "vitest";
import * as salonDb from "./db";
import * as googleAppsScript from "./googleAppsScript";
import { synchronizeCreatedBookingInBackground } from "./routers";

const booking = {
  id: 44,
  reference: "ELAF-BACKGROUND-44",
  status: "pending",
  fullName: "عميلة اختبار",
  phone: "0922119292",
  serviceName: "تسريح وتصفيف",
  startsAt: 1_800_000_000_000,
  endsAt: 1_800_003_600_000,
  preparationPlace: "منزل",
  area: null,
  locationUrl: null,
  companions: 1,
  totalPrice: 250,
  servicePrice: 250,
  depositAmount: 0,
  clientNotes: null,
  adminNotes: null,
  googleCalendarEventId: null,
};

describe("background Google synchronization after booking creation", () => {
  afterEach(() => vi.restoreAllMocks());

  it("records a successful asynchronous Calendar synchronization", async () => {
    vi.spyOn(salonDb, "getBookingForGoogleSync").mockResolvedValue(booking as never);
    vi.spyOn(googleAppsScript, "synchronizeGoogleBooking").mockResolvedValue({ ok: true, calendarEventId: "calendar-44" });
    const record = vi.spyOn(salonDb, "recordGoogleSyncResult").mockResolvedValue(undefined as never);

    await synchronizeCreatedBookingInBackground(44);

    expect(record).toHaveBeenCalledWith({ bookingId: 44, calendarEventId: "calendar-44" });
  });

  it("records a synchronization failure without throwing after the internal booking exists", async () => {
    vi.spyOn(salonDb, "getBookingForGoogleSync").mockResolvedValue(booking as never);
    vi.spyOn(googleAppsScript, "synchronizeGoogleBooking").mockRejectedValue(new googleAppsScript.GoogleAppsScriptError("GOOGLE_SYNC_UNAVAILABLE"));
    const record = vi.spyOn(salonDb, "recordGoogleSyncResult").mockResolvedValue(undefined as never);

    await expect(synchronizeCreatedBookingInBackground(44)).resolves.toBeUndefined();
    expect(record).toHaveBeenCalledWith({ bookingId: 44, error: "GOOGLE_SYNC_UNAVAILABLE" });
  });

  it("swallows read and result-recording failures so the request lifecycle cannot reject later", async () => {
    vi.spyOn(salonDb, "getBookingForGoogleSync").mockRejectedValue(new Error("database unavailable"));
    vi.spyOn(salonDb, "recordGoogleSyncResult").mockRejectedValue(new Error("audit write unavailable"));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(synchronizeCreatedBookingInBackground(44)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });

  it("cancels a booking when the asynchronous Calendar operation reports a late conflict", async () => {
    vi.spyOn(salonDb, "getBookingForGoogleSync").mockResolvedValue(booking as never);
    vi.spyOn(googleAppsScript, "synchronizeGoogleBooking").mockRejectedValue(new googleAppsScript.GoogleAppsScriptError("CALENDAR_CONFLICT"));
    const cancel = vi.spyOn(salonDb, "cancelBookingForGoogleConflict").mockResolvedValue(undefined as never);

    await synchronizeCreatedBookingInBackground(44);

    expect(cancel).toHaveBeenCalledWith(44);
  });
});
