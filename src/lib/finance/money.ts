// Finance V2 — pul arifmetikasi. Hamma narsa butun so'm (Int), foiz basis
// point. Float yo'q; yaxlitlash bitta joyda va bitta qoida bilan
// (Math.round — yarim yuqoriga), snapshot'da ko'rinadigan bo'lishi uchun.

import { MAX_MONEY } from "@/lib/constants";
import { RATE_BP_SCALE } from "./constants";

export class MoneyError extends RangeError {}

/** 0 ≤ n ≤ MAX_MONEY, butun. Sxema Int (32-bit) va MAX_MONEY (1e9) chegarasi. */
export function assertMoney(n: number, label = "summa"): number {
  if (!Number.isSafeInteger(n)) throw new MoneyError(`${label}: butun son emas (${n})`);
  if (n < 0) throw new MoneyError(`${label}: manfiy bo'lishi mumkin emas (${n})`);
  if (n > MAX_MONEY) throw new MoneyError(`${label}: chegaradan katta (${n} > ${MAX_MONEY})`);
  return n;
}

/** > 0 (to'lov, allocation, ledger qatorlari uchun) */
export function assertPositiveMoney(n: number, label = "summa"): number {
  assertMoney(n, label);
  if (n === 0) throw new MoneyError(`${label}: 0 bo'lishi mumkin emas`);
  return n;
}

/** Manfiy ham bo'lishi mumkin (adjustment), lekin |n| ≤ MAX_MONEY */
export function assertSignedMoney(n: number, label = "summa"): number {
  if (!Number.isSafeInteger(n)) throw new MoneyError(`${label}: butun son emas (${n})`);
  if (Math.abs(n) > MAX_MONEY) throw new MoneyError(`${label}: chegaradan katta (${n})`);
  return n;
}

/** 0 ≤ bp ≤ 10000 */
export function assertRateBp(bp: number, label = "foiz"): number {
  if (!Number.isInteger(bp) || bp < 0 || bp > RATE_BP_SCALE) throw new MoneyError(`${label}: 0..${RATE_BP_SCALE} bp oralig'ida bo'lishi kerak (${bp})`);
  return bp;
}

/** 40 (%) → 4000 (bp); 12.5 → 1250. Legacy SalaryRule.amount shu orqali ko'chiriladi. */
export function percentToBp(percent: number): number {
  if (!Number.isFinite(percent)) throw new MoneyError(`foiz noto'g'ri: ${percent}`);
  return assertRateBp(Math.round(percent * 100));
}

/** 4000 → "40%", 1250 → "12.5%" */
export function bpToPercentString(bp: number): string {
  assertRateBp(bp);
  const whole = Math.floor(bp / 100);
  const frac = bp % 100;
  if (frac === 0) return `${whole}%`;
  return `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}%`;
}

/**
 * amount × rateBp / 10000, yaxlitlangan. amount ≤ 1e9 va bp ≤ 1e4 →
 * ko'paytma ≤ 1e13 < 2^53 — aniqlik yo'qolmaydi.
 */
export function applyRateBp(amount: number, rateBp: number): number {
  assertMoney(amount, "baza");
  assertRateBp(rateBp);
  return Math.round((amount * rateBp) / RATE_BP_SCALE);
}

/** amount × numerator / denominator (davomat nisbati, FULL_PRICE_EQUIVALENT va h.k.) */
export function proportionalShare(amount: number, numerator: number, denominator: number): number {
  assertMoney(amount, "baza");
  if (!Number.isSafeInteger(numerator) || numerator < 0) throw new MoneyError(`hissa noto'g'ri: ${numerator}`);
  if (!Number.isSafeInteger(denominator) || denominator <= 0) throw new MoneyError(`maxraj noto'g'ri: ${denominator}`);
  if (numerator > denominator) throw new MoneyError(`hissa maxrajdan katta: ${numerator}/${denominator}`);
  return Math.round((amount * numerator) / denominator);
}

/** Chegirma: PERCENT (value = bp) yoki FIXED (value = so'm); natija 0..amount */
export function discountAmount(amount: number, type: "PERCENT" | "FIXED", value: number): number {
  assertMoney(amount, "narx");
  if (type === "PERCENT") return applyRateBp(amount, value);
  assertMoney(value, "chegirma");
  return Math.min(amount, value);
}

export function sumMoney(values: readonly number[]): number {
  return values.reduce((acc, v) => acc + assertSignedMoney(v), 0);
}
