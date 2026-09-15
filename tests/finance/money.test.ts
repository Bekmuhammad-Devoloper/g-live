import { describe, expect, it } from "vitest";

import { MAX_MONEY } from "@/lib/constants";
import { parseFinanceFlags, isAfterCutover } from "@/lib/finance/flags";
import {
  MoneyError,
  applyRateBp,
  assertMoney,
  assertPositiveMoney,
  assertRateBp,
  assertSignedMoney,
  bpToPercentString,
  discountAmount,
  percentToBp,
  proportionalShare,
  scaleByRatio,
  sumMoney,
} from "@/lib/finance/money";

describe("assertMoney", () => {
  it("0..MAX_MONEY butun — o'tadi; manfiy, kasr, katta — rad", () => {
    expect(assertMoney(0)).toBe(0);
    expect(assertMoney(MAX_MONEY)).toBe(MAX_MONEY);
    expect(() => assertMoney(-1)).toThrow(MoneyError);
    expect(() => assertMoney(1.5)).toThrow(MoneyError);
    expect(() => assertMoney(MAX_MONEY + 1)).toThrow(MoneyError);
    expect(() => assertPositiveMoney(0)).toThrow(MoneyError);
    expect(assertSignedMoney(-120_000)).toBe(-120_000);
  });
});

describe("basis point", () => {
  it("percentToBp / bpToPercentString", () => {
    expect(percentToBp(40)).toBe(4000);
    expect(percentToBp(12.5)).toBe(1250);
    expect(bpToPercentString(4000)).toBe("40%");
    expect(bpToPercentString(1250)).toBe("12.5%");
    expect(bpToPercentString(1233)).toBe("12.33%");
    expect(() => assertRateBp(10_001)).toThrow(MoneyError);
    expect(() => percentToBp(101)).toThrow(MoneyError);
  });

  it("RULE 2 — qisman to'lov proporsional: 300k→120k, 700k→280k, jami 400k", () => {
    expect(applyRateBp(300_000, 4000)).toBe(120_000);
    expect(applyRateBp(700_000, 4000)).toBe(280_000);
    expect(applyRateBp(300_000, 4000) + applyRateBp(700_000, 4000)).toBe(applyRateBp(1_000_000, 4000));
  });

  it("RULE 4 — chegirmadan keyingi real to'lov: 800k × 40% = 320k", () => {
    expect(applyRateBp(800_000, 4000)).toBe(320_000);
  });

  it("yaxlitlash: yarim yuqoriga; MAX_MONEY × 100% aniqlik yo'qotmaydi", () => {
    expect(applyRateBp(1, 5000)).toBe(1); // 0.5 → 1
    expect(applyRateBp(3, 3333)).toBe(1); // 0.9999 → 1
    expect(applyRateBp(MAX_MONEY, 10_000)).toBe(MAX_MONEY);
  });
});

describe("proportionalShare / discount", () => {
  it("davomat nisbati: 1M × 9/12 = 750k", () => {
    expect(proportionalShare(1_000_000, 9, 12)).toBe(750_000);
    expect(() => proportionalShare(1_000_000, 13, 12)).toThrow(MoneyError);
    expect(() => proportionalShare(1_000_000, 1, 0)).toThrow(MoneyError);
  });

  it("chegirma: PERCENT bp, FIXED so'm (narxdan oshmaydi)", () => {
    expect(discountAmount(1_000_000, "PERCENT", 2000)).toBe(200_000);
    expect(discountAmount(1_000_000, "FIXED", 150_000)).toBe(150_000);
    expect(discountAmount(100_000, "FIXED", 150_000)).toBe(100_000);
  });

  it("sumMoney manfiy adjustmentlarni ham qo'shadi; jami chegaradan oshsa xato", () => {
    expect(sumMoney([400_000, -120_000])).toBe(280_000);
    expect(() => sumMoney([MAX_MONEY, 1])).toThrow(MoneyError);
  });

  it("FULL_PRICE_EQUIVALENT: 800k to'lov, narx 1M, chegirma 200k → baza 1M (scaleByRatio nisbat > 1)", () => {
    expect(scaleByRatio(800_000, 1_000_000, 800_000)).toBe(1_000_000);
    expect(scaleByRatio(400_000, 1_000_000, 800_000)).toBe(500_000); // qisman to'lov ham proporsional
    expect(() => proportionalShare(800_000, 1_000_000, 800_000)).toThrow(MoneyError); // nisbat ≤ 1 talab qiladi
    expect(() => scaleByRatio(MAX_MONEY, 2, 1)).toThrow(MoneyError); // natija chegaradan oshdi
  });

  it("percentToBp: -0 chiqmaydi, 33.335 → 3334 (yarim yuqoriga, float artefaktisiz)", () => {
    expect(Object.is(percentToBp(-0.001), 0)).toBe(true);
    expect(percentToBp(33.335)).toBe(3334);
    expect(percentToBp(0)).toBe(0);
    expect(percentToBp(100)).toBe(10_000);
  });
});

describe("feature flags", () => {
  it("default: o'chiq, cutover 2026-10-01 00:00 Tashkent", () => {
    const f = parseFinanceFlags({});
    expect(f.enabled).toBe(false);
    expect(f.cutoverAt.toISOString()).toBe("2026-09-30T19:00:00.000Z");
  });

  it("faqat aynan \"true\" yoqadi; buzuq cutover standartga qaytadi", () => {
    expect(parseFinanceFlags({ "finance.v2.enabled": "true" }).enabled).toBe(true);
    expect(parseFinanceFlags({ "finance.v2.enabled": "1" }).enabled).toBe(false);
    expect(parseFinanceFlags({ "finance.v2.cutoverAt": "bugun" }).cutoverAt.toISOString()).toBe("2026-09-30T19:00:00.000Z");
  });

  it("cutover faqat Tashkent oy boshi: to'g'ri qiymat qabul, oy o'rtasi/UTC-yarim-tun/offset'siz — standart", () => {
    // 1-noyabr 00:00 Tashkent — qabul qilinadi
    expect(parseFinanceFlags({ "finance.v2.cutoverAt": "2026-11-01T00:00:00+05:00" }).cutoverAt.toISOString()).toBe("2026-10-31T19:00:00.000Z");
    // "2026-11-01" = UTC yarim tun = 05:00 Tashkent — oy boshi EMAS → standart
    expect(parseFinanceFlags({ "finance.v2.cutoverAt": "2026-11-01" }).cutoverAt.toISOString()).toBe("2026-09-30T19:00:00.000Z");
    // oy o'rtasi → standart
    expect(parseFinanceFlags({ "finance.v2.cutoverAt": "2026-11-15T00:00:00+05:00" }).cutoverAt.toISOString()).toBe("2026-09-30T19:00:00.000Z");
  });

  it("isAfterCutover — cutover lahzasi kiradi", () => {
    const f = parseFinanceFlags({});
    expect(isAfterCutover(new Date("2026-09-30T19:00:00Z"), f)).toBe(true);
    expect(isAfterCutover(new Date("2026-09-30T18:59:59Z"), f)).toBe(false);
  });
});
