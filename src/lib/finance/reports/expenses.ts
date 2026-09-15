// Finance V2 — xarajat hisobotlari (ACTIVE, V2 ga kiritilgan; teskari qatorlar ham ACTIVE lekin reversalOfId bilan —
// ular xarajat emas, tuzatish: chiqarib tashlanadi; REVERSED asl qator ham chiqmaydi).

import type { Prisma } from "@prisma/client";

import type { FinanceDb } from "../db";
import { bucketKey, sumBy, type ReportRange, type SumRow } from "./common";

export function expenseRangeWhere(r: ReportRange): Prisma.ExpenseWhereInput {
  return { status: "ACTIVE", reversalOfId: null, postedAt: { not: null }, date: { gte: r.from, lt: r.to }, ...(r.branchId ? { branchId: r.branchId } : {}) };
}

export async function expensesTotal(db: FinanceDb, r: ReportRange): Promise<{ amount: number; count: number }> {
  const agg = await db.expense.aggregate({ _sum: { amount: true }, _count: { _all: true }, where: expenseRangeWhere(r) });
  return { amount: agg._sum.amount ?? 0, count: agg._count._all };
}

export type ExpenseGroup = "category" | "branch" | "account" | "month";

export async function expensesBy(db: FinanceDb, r: ReportRange, by: ExpenseGroup): Promise<SumRow[]> {
  const rows = await db.expense.findMany({
    where: expenseRangeWhere(r),
    select: { amount: true, date: true, categoryId: true, branchId: true, financialAccountId: true, category: { select: { name: true } }, financialAccount: { select: { name: true } } },
  });
  const branches = new Map((await db.branch.findMany({ select: { id: true, name: true } })).map((b) => [b.id, b.name]));
  const keyOf = (e: (typeof rows)[number]) => (by === "category" ? e.categoryId ?? "-" : by === "branch" ? e.branchId ?? "-" : by === "account" ? e.financialAccountId ?? "-" : bucketKey(e.date, "month"));
  const labelOf = (e: (typeof rows)[number]) => (by === "category" ? e.category?.name ?? "Kategoriyasiz" : by === "branch" ? branches.get(e.branchId ?? "") ?? "Filialsiz" : by === "account" ? e.financialAccount?.name ?? "Kassa yo'q" : keyOf(e));
  return sumBy(rows, keyOf, labelOf, (e) => e.amount);
}
