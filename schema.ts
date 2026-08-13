import {
  bigint,
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 48 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  description: text("description"),
  price: int("price").notNull(),
  durationMinutes: int("durationMinutes").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const stylists = mysqlTable("stylists", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  specialty: varchar("specialty", { length: 160 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  fullName: varchar("fullName", { length: 180 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull().unique(),
  area: varchar("area", { length: 160 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const bookings = mysqlTable(
  "bookings",
  {
    id: int("id").autoincrement().primaryKey(),
    reference: varchar("reference", { length: 32 }).notNull().unique(),
    clientId: int("clientId").notNull(),
    serviceId: int("serviceId").notNull(),
    stylistId: int("stylistId"),
    startsAt: bigint("startsAt", { mode: "number" }).notNull(),
    endsAt: bigint("endsAt", { mode: "number" }).notNull(),
    companions: int("companions").default(0).notNull(),
    preparationPlace: varchar("preparationPlace", { length: 32 }).default("home").notNull(),
    locationUrl: varchar("locationUrl", { length: 1024 }),
    clientNotes: text("clientNotes"),
    totalPrice: int("totalPrice").default(0).notNull(),
    depositAmount: int("depositAmount").default(0).notNull(),
    status: mysqlEnum("status", [
      "pending",
      "confirmed",
      "cancelled",
      "rescheduled",
      "completed",
    ])
      .default("pending")
      .notNull(),
    adminNotes: text("adminNotes"),
    reminderMarkedAt: bigint("reminderMarkedAt", { mode: "number" }),
    googleCalendarEventId: varchar("googleCalendarEventId", { length: 512 }),
    googleSyncStatus: varchar("googleSyncStatus", { length: 32 }).default("pending").notNull(),
    googleSyncError: text("googleSyncError"),
    googleSyncedAt: bigint("googleSyncedAt", { mode: "number" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("bookings_startsAt_idx").on(table.startsAt),
    index("bookings_clientId_idx").on(table.clientId),
    index("bookings_status_idx").on(table.status),
  ],
);

export const bookingEvents = mysqlTable(
  "bookingEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    bookingId: int("bookingId").notNull(),
    actor: varchar("actor", { length: 64 }).notNull(),
    type: varchar("type", { length: 64 }).notNull(),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("bookingEvents_bookingId_idx").on(table.bookingId)],
);

export const bookingSlots = mysqlTable(
  "bookingSlots",
  {
    id: int("id").autoincrement().primaryKey(),
    bookingId: int("bookingId").notNull(),
    slotStartAt: bigint("slotStartAt", { mode: "number" }).notNull(),
    slotKey: varchar("slotKey", { length: 80 }).notNull().unique(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("bookingSlots_bookingId_idx").on(table.bookingId),
    index("bookingSlots_slotStartAt_idx").on(table.slotStartAt),
  ],
);

export const financeEntries = mysqlTable(
  "financeEntries",
  {
    id: int("id").autoincrement().primaryKey(),
    kind: mysqlEnum("kind", ["income", "expense"]).notNull(),
    amount: int("amount").notNull(),
    bookingId: int("bookingId").unique(),
    category: varchar("category", { length: 80 }).notNull(),
    description: text("description"),
    occurredAt: bigint("occurredAt", { mode: "number" }).notNull(),
    isVoided: boolean("isVoided").default(false).notNull(),
    voidedAt: bigint("voidedAt", { mode: "number" }),
    voidReason: varchar("voidReason", { length: 320 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("financeEntries_occurredAt_idx").on(table.occurredAt),
    index("financeEntries_kind_occurredAt_idx").on(table.kind, table.occurredAt),
  ],
);

export const salonSettings = mysqlTable("salonSettings", {
  id: int("id").autoincrement().primaryKey(),
  openingHour: int("openingHour").default(10).notNull(),
  closingHour: int("closingHour").default(20).notNull(),
  slotIntervalMinutes: int("slotIntervalMinutes").default(30).notNull(),
  maximumCompanions: int("maximumCompanions").default(9).notNull(),
  cancellationLeadHours: int("cancellationLeadHours").default(24).notNull(),
  reminderScheduleTaskUid: varchar("reminderScheduleTaskUid", { length: 65 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type SalonService = typeof services.$inferSelect;
export type Stylist = typeof stylists.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type BookingStatus = Booking["status"];
export type FinanceEntry = typeof financeEntries.$inferSelect;
export type FinanceEntryKind = FinanceEntry["kind"];
