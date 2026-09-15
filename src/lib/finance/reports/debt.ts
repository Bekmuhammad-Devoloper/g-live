// Finance V2 — qarz/kredit hisobotlari (charge/allocation dan, hech qaerda saqlanmagan).

import type { FinanceDb } from "../db";
import { OPEN_CHARGE_STATUSES, agingBucket, chargeAllocationSums, debtAging, debtorsList, paymentAvailability, remainingOf, type AgingBucket } from "../billing/balance";
import { V2_PAYMENT_WHERE } from "./common";

export interface DebtorReportRow {
  studentId: string;
  fullName: string;
  phone: string | null;
  branchId: string | null;
  debt: number;
  openCount: number;
  oldestDueDate: Date | null;
  bucket: AgingBucket | null;
}

export async function debtReport(db: FinanceDb, opts: { branchId?: string | null; at?: Date } = {}): Promise<{ rows: DebtorReportRow[]; total: number; aging: Record<AgingBucket, { amount: number; charges: number }> }> {
  const at = opts.at ?? new Date();
  const debtors = await debtorsList(db, { branchId: opts.branchId, at });
  const students = new Map((await db.student.findMany({ where: { id: { in: debtors.map((d) => d.studentId) } }, select: { id: true, fullName: true, phone: true, branchId: true } })).map((s) => [s.id, s]));
  const rows = debtors.map((d) => {
    const s = students.get(d.studentId);
    return { studentId: d.studentId, fullName: s?.fullName ?? "?", phone: s?.phone ?? null, branchId: s?.branchId ?? null, debt: d.debt, openCount: d.openCount, oldestDueDate: d.oldestDueDate, bucket: d.oldestDueDate ? agingBucket(d.oldestDueDate, at) : null };
  });
  return { rows, total: rows.reduce((a, r) => a + r.debt, 0), aging: await debtAging(db, { branchId: opts.branchId, at }) };
}

export interface StudentBalanceRow {
  studentId: string;
  fullName: string;
  branchId: string | null;
  debt: number;
  credit: number;
  net: number;
}

/** O'quvchi balanslari (qarz, kredit, net) — bir necha so'rovda, o'quvchi bo'yicha aylanmasdan */
export async function studentBalancesReport(db: FinanceDb, opts: { branchId?: string | null; onlyNonZero?: boolean } = {}): Promise<StudentBalanceRow[]> {
  const students = await db.student.findMany({ where: opts.branchId ? { branchId: opts.branchId } : {}, select: { id: true, fullName: true, branchId: true } });
  const charges = await db.studentCharge.findMany({ where: { status: { in: [...OPEN_CHARGE_STATUSES] }, studentId: { in: students.map((s) => s.id) } }, select: { id: true, studentId: true, finalAmount: true } });
  const sums = await chargeAllocationSums(db, charges.map((c) => c.id));
  const debt = new Map<string, number>();
  for (const c of charges) debt.set(c.studentId, (debt.get(c.studentId) ?? 0) + Math.max(0, remainingOf(c.finalAmount, sums.get(c.id))));
  const payments = await db.payment.findMany({ where: { ...V2_PAYMENT_WHERE, studentId: { in: students.map((s) => s.id) } }, select: { id: true, studentId: true } });
  const avail = await paymentAvailability(db, payments.map((p) => p.id));
  const credit = new Map<string, number>();
  for (const p of payments) {
    const u = avail.get(p.id)?.unallocated ?? 0;
    if (u > 0) credit.set(p.studentId, (credit.get(p.studentId) ?? 0) + u);
  }
  return students
    .map((s) => ({ studentId: s.id, fullName: s.fullName, branchId: s.branchId, debt: debt.get(s.id) ?? 0, credit: credit.get(s.id) ?? 0, net: (credit.get(s.id) ?? 0) - (debt.get(s.id) ?? 0) }))
    .filter((r) => !opts.onlyNonZero || r.debt > 0 || r.credit > 0)
    .sort((a, b) => a.net - b.net);
}

/** Kutilayotgan daromad: xizmat oyi charge'lari (WAIVED/CANCELLED emas) yig'indisi */
export async function expectedRevenue(db: FinanceDb, ym: { year: number; month: number }, branchId?: string | null): Promise<number> {
  const agg = await db.studentCharge.aggregate({ _sum: { finalAmount: true }, where: { serviceYear: ym.year, serviceMonth: ym.month, status: { in: ["OPEN", "PARTIALLY_PAID", "PAID"] }, ...(branchId ? { branchId } : {}) } });
  return agg._sum.finalAmount ?? 0;
}

/** Jami kredit (avans) — barcha o'quvchilar */
export async function totalStudentCredit(db: FinanceDb, branchId?: string | null): Promise<number> {
  const payments = await db.payment.findMany({ where: { ...V2_PAYMENT_WHERE, ...(branchId ? { branchId } : {}) }, select: { id: true } });
  const avail = await paymentAvailability(db, payments.map((p) => p.id));
  return [...avail.values()].reduce((a, p) => a + Math.max(0, p.unallocated), 0);
}

/** Jami ochiq qarz */
export async function totalOutstandingDebt(db: FinanceDb, branchId?: string | null): Promise<number> {
  return (await debtorsList(db, { branchId })).reduce((a, d) => a + d.debt, 0);
}
