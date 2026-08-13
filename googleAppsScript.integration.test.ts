import { describe, expect, it } from "vitest";

const webAppUrl = process.env.GOOGLE_APPS_SCRIPT_WEB_APP_URL;
const sharedSecret = process.env.GOOGLE_APPS_SCRIPT_SHARED_SECRET;

describe("Google Apps Script booking endpoint configuration", () => {
  it("has a deployed Web App URL and a configured shared secret", () => {
    expect(webAppUrl).toMatch(/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/);
    expect(sharedSecret).toBeTruthy();
  });
});

const describeLive = process.env.RUN_LIVE_GAS_TESTS === "1" ? describe : describe.skip;

describeLive("Google Apps Script booking endpoint live check", () => {
  it("accepts the configured shared secret for a read-only conflict check", async () => {
    expect(webAppUrl).toMatch(/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/);
    expect(sharedSecret).toBeTruthy();

    const response = await fetch(webAppUrl!, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        secret: sharedSecret,
        operation: "check",
        booking: {
          reference: "CONNECTION-CHECK-2100",
          fullName: "فحص ربط المنصة",
          phone: "0920000000",
          serviceName: "فحص اتصال فقط",
          startsAt: Date.UTC(2100, 0, 1, 10, 0, 0),
          endsAt: Date.UTC(2100, 0, 1, 11, 0, 0),
        },
      }),
    });

    expect(response.ok).toBe(true);
    const body = await response.json() as { ok?: boolean; code?: string; conflict?: { hasConflict?: boolean } };
    expect(body.code).not.toBe("UNAUTHORIZED");
    expect(body.code).not.toBe("MISSING_SCRIPT_SECRET");
    expect(body.ok).toBe(true);
    expect(typeof body.conflict?.hasConflict).toBe("boolean");
  }, 20_000);
});
