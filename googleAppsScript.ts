import { ENV } from "./_core/env";

export type GoogleBookingPayload = {
  reference: string;
  status: string;
  fullName: string;
  phone: string;
  serviceName: string;
  startsAt: number;
  endsAt: number;
  preparationPlace?: string | null;
  locationUrl?: string | null;
  companions: number;
  totalPrice: number;
  deposit: number;
  balance: number;
  notes?: string | null;
  calendarEventId?: string | null;
};

type GoogleResponse = {
  ok: boolean;
  code?: string;
  calendarEventId?: string;
  conflict?: { hasConflict?: boolean; title?: string; startsAt?: number; endsAt?: number };
};

export class GoogleAppsScriptError extends Error {
  constructor(public readonly code: string, message?: string) {
    super(message ?? code);
  }
}

export function isGoogleAppsScriptConfigured() {
  return Boolean(ENV.googleAppsScriptWebAppUrl && ENV.googleAppsScriptSharedSecret);
}

async function invokeGoogleAppsScript(operation: "check" | "create" | "update" | "cancel", booking: GoogleBookingPayload) {
  if (!isGoogleAppsScriptConfigured()) throw new GoogleAppsScriptError("GOOGLE_SYNC_NOT_CONFIGURED");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(ENV.googleAppsScriptWebAppUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: ENV.googleAppsScriptSharedSecret, operation, booking }),
      signal: controller.signal,
    });
    if (!response.ok) throw new GoogleAppsScriptError("GOOGLE_SYNC_HTTP_ERROR");
    const data = await response.json() as GoogleResponse;
    if (!data.ok) throw new GoogleAppsScriptError(data.code ?? "GOOGLE_SYNC_FAILED");
    return data;
  } catch (error) {
    if (error instanceof GoogleAppsScriptError) throw error;
    throw new GoogleAppsScriptError("GOOGLE_SYNC_UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkGoogleCalendarConflict(booking: GoogleBookingPayload) {
  const result = await invokeGoogleAppsScript("check", booking);
  return result.conflict?.hasConflict ? result.conflict : null;
}

export async function synchronizeGoogleBooking(operation: "create" | "update" | "cancel", booking: GoogleBookingPayload) {
  return invokeGoogleAppsScript(operation, booking);
}
