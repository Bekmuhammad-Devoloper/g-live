// Finance V2 — qarz/kredit/balans. Hech qaerda saqlanmaydi, har doim
// allocation qatorlaridan hisoblanadi:
//   remaining(charge) = finalAmount − Σ ALLOCATION + Σ REVERSAL
//   unallocated(payment) = amount − Σ ALLOCATION + Σ REVERSAL − Σ Refund(DONE)
//   debt = Σ remaining (OPEN | PARTIALLY_PAID)      credit = Σ unallocated (V2 ga kiritilgan to'lovlar)
//   net = credit − debt
// V2 ga kiritilgan to'lov = `Payment.postedAt IS NOT NULL` (yangi to'lovlar va backfill).

import type { FinanceDb } from "../db";
import { assertMoney } from "../money";

export const OPEN_CHARGE_STATUSES = ["OPEN", "PARTIALLY_PAID"] as const;

export interface AllocationSums {
  allocated: number;
  reversed: number;
}

/** chargeId → yig'indilar */
export async function chargeAllocationSums(db: FinanceDb, chargeIds: string[]): Promise<Map<string, AllocationSums>> {
  const out = new Map<string, AllocationSums>();
  if (chargeIds.length === 0) return out;
  const rows = await db.paymentAllocation.groupBy({ by: ["chargeId", "kind"], where: { chargeId: { in: chargeIds } }, _sum: { amount: true } });
  for (const r of rows) {
    const cur = out.get(r.chargeId) ?? { allocated: 0, reversed: 0 };
    if (r.kind === "ALLOCATION") cur.allocated += r._sum.amount ?? 0;
    else cur.reversed += r._sum.amount ?? 0;
    out.set(r.chargeId, cur);
  }
  return out;
}

export async function chargeNetAllocated(db: FinanceDb, chargeId: string): Promise<number> {
  const s = (await chargeAllocationSums(db, [chargeId])).get(chargeId);
  return s ? s.allocated - s.reversed : 0;
}

export function remainingOf(finalAmount: number, sums: AllocationSums | undefined): number {
  return finalAmount - (sums?.allocated ?? 0) + (sums?.reversed ?? 0);
}

export function statusFor(finalAmount: number, remaining: number): "OPEN" | "PARTIALLY_PAID" | "PAID" {
  if (remaining <= 0) return "PAID";
  if (remaining < finalAmount) return "PARTIALLY_PAID";
  return "OPEN";
}

/** Charge holatini allocation'lardan qayta hisoblab yozadi (CANCELLED/WAIVED tegilmaydi) */
export async function refreshChargeStatus(db: FinanceDb, chargeId: string): Promise<string> {
  const c = await db.studentCharge.findUniqueOrThrow({ where: { id: chargeId }, select: { status: true, finalAmount: true } });
  if (c.status === "CANCELLED" || c.status === "WAIVED") return c.status;
  const sums = (await chargeAllocationSums(db, [chargeId])).get(chargeId);
  const next = statusFor(c.finalAmount, remainingOf(c.finalAmount, sums));
  if (next !== c.status) await db.studentCharge.update({ where: { id: chargeId }, data: { status: next } });
  return next;
}

export interface PaymentAvailability {
  paymentId: string;
  amount: number;
  allocated: number;
  reversed: number;
  refunded: number;
  unallocated: number;
}

/** To'lovning taqsimlanmagan qismi (kredit manbai) */
export async function paymentAvailability(db: FinanceDb, paymentIds: string[]): Promise<Map<string, PaymentAvailability>> {
  const out = new Map<string, PaymentAvailability>();
  if (paymentIds.length === 0) return out;
  const [payments, allocs, refunds] = await Promise.all([
    db.payment.findMany({ where: { id: { in: paymentIds } }, select: { id: true, amount: true } }),
    db.paymentAllocation.groupBy({ by: ["paymentId", "kind"], where: { paymentId: { in: paymentIds } }, _sum: { amount: true } }),
    db.refund.groupBy({ by: ["originalPaymentId"], where: { originalPaymentId: { in: paymentIds }, status: "DONE" }, _sum: { amount: true } }),
  ]);
  for (const p of payments) out.set(p.id, { paymentId: p.id, amount: p.amount, allocated: 0, reversed: 0, refunded: 0, unallocated: p.amount });
  for (const a of allocs) {
    const cur = out.get(a.paymentId);
    if (!cur) continue;
    if (a.kind === "ALLOCATION") cur.allocated += a._sum.amount ?? 0;
    else cur.reversed += a._sum.amount ?? 0;
  }
  for (const r of refunds) {
    const cur = r.originalPaymentId ? out.get(r.originalPaymentId) : undefined;
    if (cur) cur.refunded += r._sum.amount ?? 0;
  }
  for (const cur of out.values()) cur.unallocated = cur.amount - cur.allocated + cur.reversed - cur.refunded;
  return out;
}

export interface ChargeLine {
  id: string;
  kind: string;
  groupId: string | null;
  serviceYear: number;
  serviceMonth: number;
  finalAmount: number;
  remaining: number;
  status: string;
  dueDate: Date;
}

export interface StudentBalance {
  studentId: string;
  debt: number;
  credit: number;
  /** credit − debt: musbat = markaz o'quvchiga qarzdor (avans), manfiy = o'quvchi qarzdor */
  net: number;
  openCharges: ChargeLine[];
  creditPayments: PaymentAvailability[];
}

/** O'quvchi balansi (charge'lar allaqachon `ensureMonthlyCharges` bilan yaratilgan deb hisoblanadi) */
export async function studentBalance(db: FinanceDb, studentId: string): Promise<StudentBalance> {
  const charges = await db.studentCharge.findMany({
    where: { studentId, status: { in: [...OPEN_CHARGE_STATUSES] } },
    orderBy: [{ serviceYear: "asc" }, { serviceMonth: "asc" }, { createdAt: "asc" }],
    select: { id: true, kind: true, groupId: true, serviceYear: true, serviceMonth: true, finalAmount: true, status: true, dueDate: true },
  });
  const sums = await chargeAllocationSums(db, charges.map((c) => c.id));
  const openCharges: ChargeLine[] = charges.map((c) => ({ ...c, remaining: remainingOf(c.finalAmount, sums.get(c.id)) })).filter((c) => c.remaining > 0);
  const debt = openCharges.reduce((a, c) => a + c.remaining, 0);

  const payments = await db.payment.findMany({ where: { studentId, status: "PAID", legacyRole: null, postedAt: { not: null } }, select: { id: true } });
  const avail = await paymentAvailability(db, payments.map((p) => p.id));
  const creditPayments = [...avail.values()].filter((p) => p.unallocated > 0);
  const credit = creditPayments.reduce((a, p) => a + p.unallocated, 0);
  return { studentId, debt: assertMoney(debt, "qarz"), credit: assertMoney(credit, "kredit"), net: credit - debt, openCharges, creditPayments };
}

export interface DebtorRow {
  studentId: string;
  debt: number;
  oldestDueDate: Date | null;
  openCount: number;
}

/** Qarzdorlar — bir so'rovda: ochiq charge'lar + allocation yig'indilari (branch bo'yicha) */
export async function debtorsList(db: FinanceDb, opts: { branchId?: string | null; at?: Date } = {}): Promise<DebtorRow[]> {
  const charges = await db.studentCharge.findMany({
    where: { status: { in: [...OPEN_CHARGE_STATUSES] }, ...(opts.branchId ? { branchId: opts.branchId } : {}) },
    select: { id: true, studentId: true, finalAmount: true, dueDate: true },
  });
  const sums = await chargeAllocationSums(db, charges.map((c) => c.id));
  const byStudent = new Map<string, DebtorRow>();
  for (const c of charges) {
    const remaining = remainingOf(c.finalAmount, sums.get(c.id));
    if (remaining <= 0) continue;
    const row = byStudent.get(c.studentId) ?? { studentId: c.studentId, debt: 0, oldestDueDate: null, openCount: 0 };
    row.debt += remaining;
    row.openCount++;
    if (!row.oldestDueDate || c.dueDate < row.oldestDueDate) row.oldestDueDate = c.dueDate;
    byStudent.set(c.studentId, row);
  }
  return [...byStudent.values()].sort((a, b) => b.debt - a.debt);
}

export const AGING_BUCKETS = ["current", "1-3", "4-7", "8-30", "30+"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

export function agingBucket(dueDate: Date, at: Date): AgingBucket {
  const days = Math.floor((at.getTime() - dueDate.getTime()) / DAY_MS);
  if (days <= 0) return "current";
  if (days <= 3) return "1-3";
  if (days <= 7) return "4-7";
  if (days <= 30) return "8-30";
  return "30+";
}

/** Qarz yoshi: muddat o'tgan kunlar bo'yicha bucket'lar (S20 dueDate asosida) */
export async function debtAging(db: FinanceDb, opts: { branchId?: string | null; at?: Date } = {}): Promise<Record<AgingBucket, { amount: number; charges: number }>> {
  const at = opts.at ?? new Date();
  const charges = await db.studentCharge.findMany({
    where: { status: { in: [...OPEN_CHARGE_STATUSES] }, ...(opts.branchId ? { branchId: opts.branchId } : {}) },
    select: { id: true, finalAmount: true, dueDate: true },
  });
  const sums = await chargeAllocationSums(db, charges.map((c) => c.id));
  const out = Object.fromEntries(AGING_BUCKETS.map((b) => [b, { amount: 0, charges: 0 }])) as Record<AgingBucket, { amount: number; charges: number }>;
  for (const c of charges) {
    const remaining = remainingOf(c.finalAmount, sums.get(c.id));
    if (remaining <= 0) continue;
    const b = agingBucket(c.dueDate, at);
    out[b].amount += remaining;
    out[b].charges++;
  }
  return out;
}
