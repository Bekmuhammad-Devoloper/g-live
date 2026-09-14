import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MAX_MONEY, PAYMENT_METHODS } from "@/lib/constants";
import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// Phase 0 (SAFETY) — test harness tayyorligini tekshiradi:
//   1. `@/` alias va loyiha kodi vitest ichida o'qiladi
//   2. Tashkent oy chegarasi jarayon TZ'sidan QAT'I NAZAR to'g'ri aniqlanadi
//      (CI bu faylni TZ=UTC va TZ=Asia/Tashkent da ikki marta ishlatadi)
//   3. Har test fayli o'z vaqtinchalik SQLite bazasini oladi va yoza oladi
//
// Finance V2 domain kodi (lib/finance/period.ts) Phase 1'da yoziladi — shu
// yerdagi Intl yondashuvi o'sha modulning asosi bo'ladi.

const TASHKENT = "Asia/Tashkent";

/** Berilgan lahza Tashkent taqvimida qaysi (yil, oy)ga tushadi */
function tashkentYearMonth(at: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TASHKENT, year: "numeric", month: "numeric" }).formatToParts(at);
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: pick("year"), month: pick("month") };
}

describe("finance v2 readiness", () => {
  it("loyiha konstantalari vitest ichida o'qiladi", () => {
    expect(PAYMENT_METHODS).toContain("CASH");
    expect(MAX_MONEY).toBe(1_000_000_000);
  });

  it("31-oktabr 23:59 Tashkent — oktabr; 1-noyabr 00:01 Tashkent — noyabr (TZ dan qat'i nazar)", () => {
    // Tashkent = UTC+5, yozgi vaqt yo'q
    expect(tashkentYearMonth(new Date("2026-10-31T18:59:00Z"))).toEqual({ year: 2026, month: 10 });
    expect(tashkentYearMonth(new Date("2026-10-31T19:01:00Z"))).toEqual({ year: 2026, month: 11 });
    // Yil chegarasi ham
    expect(tashkentYearMonth(new Date("2026-12-31T19:00:00Z"))).toEqual({ year: 2027, month: 1 });
  });
});

describe("prisma test bazasi", () => {
  let db: TestDb;

  beforeAll(() => {
    db = createTestDb("readiness");
  });

  afterAll(async () => {
    await db.dispose();
  });

  it("yozadi va o'qiydi (Setting)", async () => {
    await db.prisma.setting.upsert({
      where: { key: "finance.v2.enabled" },
      create: { key: "finance.v2.enabled", value: "false" },
      update: { value: "false" },
    });

    const row = await db.prisma.setting.findUnique({ where: { key: "finance.v2.enabled" } });

    expect(row?.value).toBe("false");
    // Shablon baza bo'sh — test ma'lumoti faqat shu nusxada
    expect(await db.prisma.payment.count()).toBe(0);
  });
});
