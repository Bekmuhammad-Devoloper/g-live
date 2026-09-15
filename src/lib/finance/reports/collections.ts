// Finance V2 — yig'imlar (collections) va daromad taqsimoti.

import type { FinanceDb } from "../db";
import { bucketKey, paymentRangeWhere, sumBy, type ReportRange, type SumRow } from "./common";

export type CollectionsGroup = "day" | "month" | "year" | "method" | "account" | "branch";

/** Yig'ilgan pul (receivedAt bo'yicha): kun/oy/yil/usul/kassa/filial kesimida */
export async function collections(db: FinanceDb, r: ReportRange, by: CollectionsGroup): Promise<SumRow[]> {
  const rows = await db.payment.findMany({
    where: paymentRangeWhere(r),
    select: { amount: true, receivedAt: true, method: true, financialAccountId: true, branchId: true, financialAccount: { select: { name: true } }, branch: { select: { name: true } } },
  });
  const keyOf = (p: (typeof rows)[number]) => {
    if (by === "method") return p.method;
    if (by === "account") return p.financialAccountId ?? "-";
    if (by === "branch") return p.branchId ?? "-";
    return bucketKey(p.receivedAt!, by);
  };
  const labelOf = (p: (typeof rows)[number]) => {
    if (by === "method") return p.method;
    if (by === "account") return p.financialAccount?.name ?? "Kassa yo'q";
    if (by === "branch") return p.branch?.name ?? "Filialsiz";
    return keyOf(p);
  };
  return sumBy(rows, keyOf, labelOf, (p) => p.amount);
}

export async function collectionsTotal(db: FinanceDb, r: ReportRange): Promise<{ amount: number; count: number }> {
  const agg = await db.payment.aggregate({ _sum: { amount: true }, _count: { _all: true }, where: paymentRangeWhere(r) });
  return { amount: agg._sum.amount ?? 0, count: agg._count._all };
}

export async function refundsTotal(db: FinanceDb, r: ReportRange): Promise<{ amount: number; count: number }> {
  const agg = await db.refund.aggregate({ _sum: { amount: true }, _count: { _all: true }, where: { status: "DONE", refundedAt: { gte: r.from, lt: r.to }, ...(r.branchId ? { branchId: r.branchId } : {}) } });
  return { amount: agg._sum.amount ?? 0, count: agg._count._all };
}

export type RevenueGroup = "program" | "group" | "teacher";

/**
 * Daromad taqsimoti — TAQSIMLANGAN to'lovlar bo'yicha (allocation → charge → kurs/guruh;
 * o'qituvchi → POSTED commission earning'ning allocation'i). Kredit (taqsimlanmagan) kirmaydi.
 */
export async function revenueBy(db: FinanceDb, r: ReportRange, by: RevenueGroup): Promise<SumRow[]> {
  if (by === "teacher") {
    const earnings = await db.teacherEarning.findMany({
      where: { type: "PAYMENT_COMMISSION", status: "POSTED", receivedAt: { gte: r.from, lt: r.to }, ...(r.branchId ? { branchId: r.branchId } : {}) },
      select: { teacherId: true, allocationId: true, teacher: { select: { fullName: true } }, allocation: { select: { amount: true } } },
    });
    // bir allocation bir necha o'qituvchiga (MAIN+ASSISTANT) — har biriga to'liq allocation emas, birinchi (MAIN) ga
    const seen = new Set<string>();
    const rows = earnings.filter((e) => { if (!e.allocationId || seen.has(e.allocationId)) return false; seen.add(e.allocationId); return true; });
    return sumBy(rows, (e) => e.teacherId, (e) => e.teacher.fullName, (e) => e.allocation?.amount ?? 0);
  }
  const allocs = await db.paymentAllocation.findMany({
    where: { kind: "ALLOCATION", payment: paymentRangeWhere(r) },
    select: { amount: true, charge: { select: { groupId: true, programId: true, group: { select: { name: true } }, program: { select: { name: true } } } } },
  });
  const reversals = await db.paymentAllocation.findMany({
    where: { kind: "REVERSAL", payment: paymentRangeWhere(r) },
    select: { amount: true, charge: { select: { groupId: true, programId: true, group: { select: { name: true } }, program: { select: { name: true } } } } },
  });
  const rows = [...allocs.map((a) => ({ ...a, sign: 1 })), ...reversals.map((a) => ({ ...a, sign: -1 }))];
  return by === "group"
    ? sumBy(rows, (a) => a.charge.groupId ?? "-", (a) => a.charge.group?.name ?? "Guruhsiz", (a) => a.sign * a.amount)
    : sumBy(rows, (a) => a.charge.programId ?? "-", (a) => a.charge.program?.name ?? "Kurssiz", (a) => a.sign * a.amount);
}
