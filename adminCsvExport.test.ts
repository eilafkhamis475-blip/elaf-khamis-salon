import { describe, expect, it } from "vitest";
import { buildAdminCsvExport } from "./adminCsvExport";

describe("buildAdminCsvExport", () => {
  it("creates a UTF-8 BOM CSV with Excel formulas and sanitized client text", () => {
    const report = buildAdminCsvExport({
      generatedAt: Date.parse("2026-08-13T19:00:00.000Z"),
      bookings: [{
        id: 3,
        reference: "ELAF-ABC123",
        fullName: "=غير آمن",
        phone: "0922119292",
        area: "طرابلس",
        serviceName: "تسريح وتصفيف",
        startsAt: Date.parse("2026-08-14T08:00:00.000Z"),
        status: "confirmed",
        companions: 2,
        preparationPlace: "home",
        locationUrl: null,
        clientNotes: null,
        totalPrice: 250,
        depositAmount: 50,
        adminNotes: null,
      }],
      ledgerEntries: [
        { id: 8, kind: "income", amount: 250, category: "إيراد حجز", description: "تأكيد الحجز", occurredAt: Date.parse("2026-08-13T19:00:00.000Z"), bookingId: 3, isVoided: false, voidReason: null },
        { id: 9, kind: "expense", amount: 75, category: "تنقل", description: null, occurredAt: Date.parse("2026-08-13T19:10:00.000Z"), bookingId: null, isVoided: false, voidReason: null },
        { id: 10, kind: "income", amount: 800, category: "إيراد ملغى", description: null, occurredAt: Date.parse("2026-08-13T19:20:00.000Z"), bookingId: null, isVoided: true, voidReason: "تم الإلغاء" },
      ],
    });

    expect(report.filename).toBe("elaf-khamis-report-2026-08-13.csv");
    expect(report.csv.startsWith("\uFEFF")).toBe(true);
    expect(report.csv).toContain("=SUMIFS(");
    expect(report.csv).toContain('=SUMIFS(C15:C17,B15:B17,""إيراد"",H15:H17,""نشط"")');
    expect(report.csv).toContain("=B5-B6");
    expect(report.csv).toContain("'=غير آمن");
    expect(report.csv).toContain("تسريح وتصفيف");

    const rows = report.csv.slice(1).split("\r\n");
    expect(rows[13]).toContain("رقم القيد");
    expect(rows[14]).toContain("إيراد");
    expect(report.totals).toEqual({ income: 250, expense: 75, net: 175 });
  });
});
