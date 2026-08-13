import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const code = readFileSync(resolve(process.cwd(), "docs/google-apps-script/Code.gs"), "utf8");

describe("Google Apps Script WhatsApp Business notifications", () => {
  it("keeps the booking notification behind Script Properties and a Utility template call", () => {
    expect(code).toContain("function sendWhatsAppBookingNotification_(booking)");
    expect(code).toContain("UrlFetchApp.fetch");
    expect(code).toContain("WHATSAPP_ACCESS_TOKEN");
    expect(code).toContain("WHATSAPP_PHONE_NUMBER_ID");
    expect(code).toContain("WHATSAPP_TEMPLATE_NAME");
    expect(code).toContain("type: 'template'");
    expect(code).toContain("operation === 'create'");
  });

  it("normalises the owner WhatsApp number without exposing an access token in source", () => {
    expect(code).toContain("function normaliseWhatsAppPhone_(phone)");
    expect(code).toContain("'00218922119292'");
    expect(code).not.toMatch(/WHATSAPP_ACCESS_TOKEN'\s*:\s*['\"](?!WHATSAPP_ACCESS_TOKEN)/);
  });
});
