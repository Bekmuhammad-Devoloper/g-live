// Finance V2 hisobotlari — umumiy turlar va filtr.
// Barcha hisobotlar FAQAT V2 ga kiritilgan faktlarga tayanadi:
//   to'lov (kassa/yig'im): Payment{status PAID, legacyRole null|HISTORICAL, postedAt ≠ null}, sana = receivedAt
//     — HISTORICAL = cutover'dan oldingi real to'lov: kassaga BIR marta kirgan, lekin V2 krediti EMAS
//   kredit: faqat legacyRole null (V2_PAYMENT_WHERE)
//   ledger: FinancialTransaction (occurredAt)
//   qarz/kredit: charge/allocation (balance.ts)
//   maosh: TeacherEarning POSTED, SalaryPeriod, SalaryPayout

import type { Prisma } from "@prisma/client";

import { monthEnd, monthStart, tashkentYearMonth, yearMonthKey, type YearMonth } from "../period";

export interface ReportRange {
  /** inclusive */
  from: Date;
  /** exclusive */
  to: Date;
  branchId?: string | null;
}

export const monthRange = (ym: YearMonth, branchId?: string | null): ReportRange => ({ from: monthStart(ym), to: monthEnd(ym), branchId });

/** Kredit/balansga ta'sir qiluvchi V2 to'lovlar (tarixiy HISTORICAL emas) */
export const V2_PAYMENT_WHERE: Prisma.PaymentWhereInput = { status: "PAID", legacyRole: null, postedAt: { not: null } };
/** Kassaga kirgan real pul (yig'im hisobotlari): V2 + tarixiy (HISTORICAL) — har biri bir marta */
export const V2_RECEIPT_WHERE: Prisma.PaymentWhereInput = { status: "PAID", postedAt: { not: null }, OR: [{ legacyRole: null }, { legacyRole: "HISTORICAL" }] };

export function paymentRangeWhere(r: ReportRange): Prisma.PaymentWhereInput {
  return { ...V2_RECEIPT_WHERE, receivedAt: { gte: r.from, lt: r.to }, ...(r.branchId ? { branchId: r.branchId } : {}) };
}

export function ledgerRangeWhere(r: ReportRange): Prisma.FinancialTransactionWhereInput {
  return { occurredAt: { gte: r.from, lt: r.to }, ...(r.branchId ? { branchId: r.branchId } : {}) };
}

/** Sana → guruhlash kaliti (Tashkent) */
export function bucketKey(at: Date, by: "day" | "month" | "year"): string {
  const ym = tashkentYearMonth(at);
  if (by === "year") return String(ym.year);
  if (by === "month") return yearMonthKey(ym);
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  return d; // YYYY-MM-DD
}

export interface SumRow {
  key: string;
  label: string;
  amount: number;
  count: number;
}

export function sumBy<T>(rows: T[], keyOf: (r: T) => string, labelOf: (r: T) => string, amountOf: (r: T) => number): SumRow[] {
  const map = new Map<string, SumRow>();
  for (const r of rows) {
    const key = keyOf(r);
    const cur = map.get(key) ?? { key, label: labelOf(r), amount: 0, count: 0 };
    cur.amount += amountOf(r);
    cur.count++;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}
