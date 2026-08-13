export type BookingExportRow = {
  id: number;
  reference: string;
  fullName: string;
  phone: string;
  area: string | null;
  serviceName: string;
  startsAt: number;
  status: string;
  companions: number;
  preparationPlace: string;
  locationUrl: string | null;
  clientNotes: string | null;
  totalPrice: number;
  depositAmount: number;
  adminNotes: string | null;
};

export type LedgerExportRow = {
  id: number;
  kind: "income" | "expense";
  amount: number;
  category: string;
  description: string | null;
  occurredAt: number;
  bookingId: number | null;
  isVoided: boolean;
  voidReason: string | null;
};

function formatTripoliDate(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Tripoli",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(timestamp));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")} ${value("hour")}:${value("minute")}`;
}

function csvCell(value: string | number | null | undefined, allowFormula = false) {
  let text = value == null ? "" : String(value).replace(/\r?\n/g, " ");
  if (!allowFormula && /^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(values: Array<string | number | null | undefined>, formulaIndexes: number[] = []) {
  return values.map((value, index) => csvCell(value, formulaIndexes.includes(index))).join(",");
}

export function buildAdminCsvExport({
  bookings,
  ledgerEntries,
  generatedAt = Date.now(),
}: {
  bookings: BookingExportRow[];
  ledgerEntries: LedgerExportRow[];
  generatedAt?: number;
}) {
  const bookingHeaders = ["رقم الحجز", "اسم العميلة", "الهاتف", "المنطقة", "الخدمة", "التاريخ والوقت", "الحالة", "المرافقون", "مكان التجهيز", "رابط الموقع", "ملاحظات العميلة", "قيمة الخدمة د.ل.", "العربون د.ل.", "ملاحظات الإدارة"];
  const ledgerHeaders = ["رقم القيد", "نوع القيد", "المبلغ د.ل.", "التصنيف", "الوصف", "التاريخ", "رقم الحجز", "الحالة", "سبب الإلغاء"];
  // Rows 1–10 contain the report summary and booking headers; the ledger header follows
  // one blank separator and one ledger-section title after the booking data.
  const ledgerHeaderRow = 13 + bookings.length;
  const ledgerFirstDataRow = ledgerHeaderRow + 1;
  const ledgerLastDataRow = Math.max(ledgerFirstDataRow, ledgerFirstDataRow + ledgerEntries.length - 1);
  const incomeFormula = `=SUMIFS(C${ledgerFirstDataRow}:C${ledgerLastDataRow},B${ledgerFirstDataRow}:B${ledgerLastDataRow},"إيراد",H${ledgerFirstDataRow}:H${ledgerLastDataRow},"نشط")`;
  const expenseFormula = `=SUMIFS(C${ledgerFirstDataRow}:C${ledgerLastDataRow},B${ledgerFirstDataRow}:B${ledgerLastDataRow},"مصروف",H${ledgerFirstDataRow}:H${ledgerLastDataRow},"نشط")`;
  const totals = ledgerEntries.reduce((summary, entry) => {
    if (entry.isVoided) return summary;
    if (entry.kind === "income") summary.income += entry.amount;
    else summary.expense += entry.amount;
    summary.net = summary.income - summary.expense;
    return summary;
  }, { income: 0, expense: 0, net: 0 });
  const lines = [
    csvRow(["تقرير الحجوزات والمالية — صالون إيلاف خميس"]),
    csvRow(["تاريخ التصدير", formatTripoliDate(generatedAt)]),
    csvRow([]),
    csvRow(["ملخص مالي قابل للحساب داخل Excel"]),
    csvRow(["إجمالي الإيرادات", incomeFormula], [1]),
    csvRow(["إجمالي المصاريف", expenseFormula], [1]),
    csvRow(["صافي الربح", "=B5-B6"], [1]),
    csvRow([]),
    csvRow(["بيانات الحجوزات"]),
    csvRow(bookingHeaders),
    ...bookings.map(booking => csvRow([
      booking.reference,
      booking.fullName,
      booking.phone,
      booking.area,
      booking.serviceName,
      formatTripoliDate(booking.startsAt),
      booking.status,
      booking.companions,
      booking.preparationPlace === "venue" ? "صالة/مكان مناسبة" : "منزل",
      booking.locationUrl,
      booking.clientNotes,
      booking.totalPrice,
      booking.depositAmount,
      booking.adminNotes,
    ])),
    csvRow([]),
    csvRow(["سجل القيود المالية"]),
    csvRow(ledgerHeaders),
    ...ledgerEntries.map(entry => csvRow([
      entry.id,
      entry.kind === "income" ? "إيراد" : "مصروف",
      entry.amount,
      entry.category,
      entry.description,
      formatTripoliDate(entry.occurredAt),
      entry.bookingId,
      entry.isVoided ? "ملغى" : "نشط",
      entry.voidReason,
    ])),
  ];

  return {
    filename: `elaf-khamis-report-${new Date(generatedAt).toISOString().slice(0, 10)}.csv`,
    csv: `\uFEFF${lines.join("\r\n")}`,
    totals,
  };
}
