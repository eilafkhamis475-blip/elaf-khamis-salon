import { describe, expect, it } from "vitest";
import { buildBookingWhatsAppUrl } from "../client/src/lib/whatsappBookingTemplate";

describe("booking WhatsApp template", () => {
  it("includes the approved phone, reference, location note, and inclusive companion wording", () => {
    const url = buildBookingWhatsAppUrl({
      reference: "ELAF-TEST-001",
      fullName: "أسماء علي",
      preparationPlace: "صالة أفراح",
      dateLabel: "الخميس 14 أغسطس 2026",
      timeLabel: "10:00 ص",
      companions: 2,
      serviceName: "تسريح وتصفيف",
      priceLabel: "250 د.ل.",
    });

    expect(url).toMatch(/^https:\/\/wa\.me\/218922119292\?text=/);
    const message = decodeURIComponent(url.split("?text=")[1]);
    expect(message).toContain("خبيرة التصفيف إيلاف خميس");
    expect(message).toContain("🔖 رقم الحجز (المرجع): ELAF-TEST-001");
    expect(message).toContain("3 (شامل العروس/الزبونة)");
    expect(message).toContain("سأقوم بإرسال موقعي الجغرافي في الرسالة التالية");
  });
});
