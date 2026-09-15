// Finance V2 — maosh hisobotlari: earning'lar (o'qituvchi/oy), davrlar, to'lovlar, to'lanmagan maosh.

import type { FinanceDb } from "../db";
import { yearMonthKey, type YearMonth } from "../period";
import { sumBy, type ReportRange, type SumRow } from "./common";

export interface TeacherEarningsRow {
  teacherId: string;
  teacherName: string;
  commission: number;
  fixed: number;
  bonus: number;
  kpi: number;
  penalty: number;
  adjustment: number;
  total: number;
  needsReview: number;
}

/** O'qituvchi bo'yicha POSTED earning'lar (earningMonth bo'yicha) + NEEDS_REVIEW soni */
export async function teacherEarningsReport(db: FinanceDb, ym: YearMonth, branchId?: string | null): Promise<TeacherEarningsRow[]> {
  const rows = await db.teacherEarning.findMany({
    where: { earningYear: ym.year, earningMonth: ym.month, ...(branchId ? { branchId } : {}) },
    select: { teacherId: true, type: true, status: true, amount: true, teacher: { select: { fullName: true } } },
  });
  const map = new Map<string, TeacherEarningsRow>();
  for (const r of rows) {
    const cur = map.get(r.teacherId) ?? { teacherId: r.teacherId, teacherName: r.teacher.fullName, commission: 0, fixed: 0, bonus: 0, kpi: 0, penalty: 0, adjustment: 0, total: 0, needsReview: 0 };
    if (r.status === "NEEDS_REVIEW") { cur.needsReview++; map.set(r.teacherId, cur); continue; }
    if (r.type === "PAYMENT_COMMISSION") cur.commission += r.amount;
    else if (r.type === "FIXED") cur.fixed += r.amount;
    else if (r.type === "BONUS") cur.bonus += r.amount;
    else if (r.type === "KPI") cur.kpi += r.amount;
    else if (r.type === "PENALTY") cur.penalty += -r.amount;
    else cur.adjustment += r.amount;
    cur.total = cur.commission + cur.fixed + cur.bonus + cur.kpi - cur.penalty + cur.adjustment;
    map.set(r.teacherId, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export interface SalaryPeriodRow {
  periodId: string;
  teacherId: string;
  teacherName: string;
  period: string;
  status: string;
  gross: number;
  paid: number;
  remaining: number;
  source: string;
}

export async function salaryPeriodsReport(db: FinanceDb, opts: { ym?: YearMonth; teacherId?: string; statuses?: string[] } = {}): Promise<SalaryPeriodRow[]> {
  const rows = await db.salaryPeriod.findMany({
    where: { ...(opts.ym ? { year: opts.ym.year, month: opts.ym.month } : {}), ...(opts.teacherId ? { teacherId: opts.teacherId } : {}), ...(opts.statuses ? { status: { in: opts.statuses } } : {}) },
    include: { teacher: { select: { fullName: true } } },
    orderBy: [{ year: "desc" }, { month: "desc" }, { teacher: { fullName: "asc" } }],
  });
  return rows.map((p) => ({ periodId: p.id, teacherId: p.teacherId, teacherName: p.teacher.fullName, period: yearMonthKey({ year: p.year, month: p.month }), status: p.status, gross: p.grossAmount, paid: p.paidAmount, remaining: p.remainingAmount, source: p.source }));
}

/** To'lanmagan maosh (majburiyat): APPROVED/PARTIALLY_PAID davrlar qoldig'i */
export async function unpaidSalaryReport(db: FinanceDb): Promise<{ rows: SalaryPeriodRow[]; total: number }> {
  const rows = (await salaryPeriodsReport(db, { statuses: ["APPROVED", "PARTIALLY_PAID"] })).filter((r) => r.remaining > 0);
  return { rows, total: rows.reduce((a, r) => a + r.remaining, 0) };
}

export async function salaryLiability(db: FinanceDb): Promise<number> {
  return (await unpaidSalaryReport(db)).total;
}

export interface PayoutRow {
  payoutId: string;
  teacherId: string;
  teacherName: string;
  period: string;
  amount: number;
  paidAt: Date;
  accountName: string;
  note: string | null;
}

export async function payoutsReport(db: FinanceDb, r: ReportRange): Promise<{ rows: PayoutRow[]; total: number; byAccount: SumRow[] }> {
  const rows = await db.salaryPayout.findMany({
    where: { status: "DONE", paidAt: { gte: r.from, lt: r.to }, ...(r.branchId ? { branchId: r.branchId } : {}) },
    include: { teacher: { select: { fullName: true } }, salaryPeriod: { select: { year: true, month: true } }, financialAccount: { select: { name: true } } },
    orderBy: { paidAt: "asc" },
  });
  const out = rows.map((p) => ({ payoutId: p.id, teacherId: p.teacherId, teacherName: p.teacher.fullName, period: yearMonthKey({ year: p.salaryPeriod.year, month: p.salaryPeriod.month }), amount: p.amount, paidAt: p.paidAt, accountName: p.financialAccount.name, note: p.note }));
  return { rows: out, total: out.reduce((a, x) => a + x.amount, 0), byAccount: sumBy(rows, (p) => p.financialAccountId, (p) => p.financialAccount.name, (p) => p.amount) };
}

export async function salaryPaidTotal(db: FinanceDb, r: ReportRange): Promise<number> {
  const agg = await db.salaryPayout.aggregate({ _sum: { amount: true }, where: { status: "DONE", paidAt: { gte: r.from, lt: r.to }, ...(r.branchId ? { branchId: r.branchId } : {}) } });
  return agg._sum.amount ?? 0;
}

/** Oy bo'yicha hisoblangan (accrual) maosh: POSTED earning'lar earningMonth bo'yicha */
export async function salaryAccrued(db: FinanceDb, ym: YearMonth, branchId?: string | null): Promise<number> {
  const agg = await db.teacherEarning.aggregate({ _sum: { amount: true }, where: { status: "POSTED", earningYear: ym.year, earningMonth: ym.month, ...(branchId ? { branchId } : {}) } });
  return agg._sum.amount ?? 0;
}
