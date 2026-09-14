import { describe, expect, it } from "vitest";

import {
  compareYearMonth,
  daysInMonth,
  floorToTashkentMonth,
  isTashkentMonthStart,
  isWithin,
  monthEnd,
  monthStart,
  monthsBetween,
  nextMonth,
  parseYearMonthKey,
  prevMonth,
  tashkentDate,
  tashkentYearMonth,
  yearMonthKey,
} from "@/lib/finance/period";

// Bu fayl CI'da TZ=UTC va TZ=Asia/Tashkent da ikki marta ishlaydi —
// natijalar ikkalasida ham bir xil bo'lishi shart.

describe("tashkentYearMonth", () => {
  it("31-oktabr 23:59 Tashkent → oktabr; 1-noyabr 00:01 → noyabr", () => {
    expect(tashkentYearMonth(new Date("2026-10-31T18:59:00Z"))).toEqual({ year: 2026, month: 10 });
    expect(tashkentYearMonth(new Date("2026-10-31T19:00:00Z"))).toEqual({ year: 2026, month: 11 });
    expect(tashkentYearMonth(new Date("2026-10-31T19:01:00Z"))).toEqual({ year: 2026, month: 11 });
  });

  it("yil chegarasi: 31-dek 23:30 Tashkent — dekabr; UTC'da bu hali 18:30", () => {
    expect(tashkentYearMonth(new Date("2026-12-31T18:30:00Z"))).toEqual({ year: 2026, month: 12 });
    expect(tashkentYearMonth(new Date("2026-12-31T19:00:00Z"))).toEqual({ year: 2027, month: 1 });
  });

  it("jarayon TZ'siga bog'liq emas: mahalliy Date ham to'g'ri", () => {
    // 2026-09-30T20:00 UTC = 1-oktabr 01:00 Tashkent
    const at = new Date(Date.UTC(2026, 8, 30, 20, 0, 0));
    expect(tashkentYearMonth(at)).toEqual({ year: 2026, month: 10 });
  });
});

describe("monthStart / monthEnd", () => {
  it("oktabr 2026 boshi = 2026-09-30T19:00Z; Intl bilan mos", () => {
    const start = monthStart({ year: 2026, month: 10 });
    expect(start.toISOString()).toBe("2026-09-30T19:00:00.000Z");
    expect(tashkentYearMonth(start)).toEqual({ year: 2026, month: 10 });
    // Bir millisekund oldin — hali sentabr
    expect(tashkentYearMonth(new Date(start.getTime() - 1))).toEqual({ year: 2026, month: 9 });
  });

  it("monthEnd exclusive: keyingi oy boshi", () => {
    expect(monthEnd({ year: 2026, month: 12 }).toISOString()).toBe("2026-12-31T19:00:00.000Z");
    expect(tashkentYearMonth(monthEnd({ year: 2026, month: 12 }))).toEqual({ year: 2027, month: 1 });
  });

  it("har oy uchun start ↔ Intl mosligi (2025–2027)", () => {
    for (let year = 2025; year <= 2027; year++) {
      for (let month = 1; month <= 12; month++) {
        const s = monthStart({ year, month });
        expect(tashkentYearMonth(s)).toEqual({ year, month });
        expect(tashkentYearMonth(new Date(s.getTime() - 1))).toEqual(prevMonth({ year, month }));
        expect(isTashkentMonthStart(s)).toBe(true);
        expect(isTashkentMonthStart(new Date(s.getTime() + 1))).toBe(false);
      }
    }
  });

  it("noto'g'ri oy rad etiladi", () => {
    expect(() => monthStart({ year: 2026, month: 13 })).toThrow(RangeError);
    expect(() => monthStart({ year: 2026, month: 0 })).toThrow(RangeError);
    expect(() => monthStart({ year: 1999, month: 1 })).toThrow(RangeError);
  });
});

describe("oy arifmetikasi", () => {
  it("next/prev/compare", () => {
    expect(nextMonth({ year: 2026, month: 12 })).toEqual({ year: 2027, month: 1 });
    expect(prevMonth({ year: 2027, month: 1 })).toEqual({ year: 2026, month: 12 });
    expect(compareYearMonth({ year: 2026, month: 9 }, { year: 2026, month: 10 })).toBeLessThan(0);
    expect(compareYearMonth({ year: 2027, month: 1 }, { year: 2026, month: 12 })).toBeGreaterThan(0);
  });

  it("monthsBetween — ikkalasi ham kiradi; teskari bo'lsa bo'sh", () => {
    expect(monthsBetween({ year: 2026, month: 11 }, { year: 2027, month: 2 }).map(yearMonthKey)).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(monthsBetween({ year: 2026, month: 3 }, { year: 2026, month: 2 })).toEqual([]);
  });

  it("yearMonthKey / parseYearMonthKey", () => {
    expect(yearMonthKey({ year: 2026, month: 9 })).toBe("2026-09");
    expect(parseYearMonthKey("2026-09")).toEqual({ year: 2026, month: 9 });
    expect(() => parseYearMonthKey("2026-9")).toThrow(RangeError);
    expect(() => parseYearMonthKey("2026-13")).toThrow(RangeError);
  });

  it("floorToTashkentMonth", () => {
    expect(floorToTashkentMonth(new Date("2026-10-15T10:00:00Z")).toISOString()).toBe("2026-09-30T19:00:00.000Z");
  });
});

describe("tashkentDate / dueDate", () => {
  it("dueDay=1 → oy boshi; 31 → fevralda 28", () => {
    expect(tashkentDate({ year: 2026, month: 10 }, 1).getTime()).toBe(monthStart({ year: 2026, month: 10 }).getTime());
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28);
    expect(daysInMonth({ year: 2028, month: 2 })).toBe(29);
    expect(tashkentDate({ year: 2026, month: 2 }, 31).toISOString()).toBe("2026-02-27T19:00:00.000Z"); // 28-fev 00:00 Tashkent
  });

  it("isWithin — [from, to), to=null ochiq", () => {
    const from = new Date("2026-10-01T00:00:00Z");
    const to = new Date("2026-11-01T00:00:00Z");
    expect(isWithin(from, from, to)).toBe(true);
    expect(isWithin(to, from, to)).toBe(false);
    expect(isWithin(new Date("2030-01-01T00:00:00Z"), from, null)).toBe(true);
  });
});
