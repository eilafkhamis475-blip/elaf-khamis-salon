import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createNonAdminContext(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "standard-user",
      email: "user@example.com",
      name: "Standard User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("admin management procedures", () => {
  it("rejects non-administrators before accessing salon data", async () => {
    const caller = appRouter.createCaller(createNonAdminContext());
    await expect(caller.admin.services()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.clients()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.activity({ bookingId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.finance()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.exportCsv()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.createExpense({ amount: 50, category: "مستلزمات" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.voidExpense({ entryId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.reminderSchedule()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.enableReminderSchedule()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
