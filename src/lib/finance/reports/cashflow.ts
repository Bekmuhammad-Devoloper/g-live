// Finance V2 — Cash Flow (ledger) va P&L (accrual) — ALOHIDA (S19).
//   Cash Flow: kassa harakati — IN/OUT turlari bo'yicha, transferlar ichki (net 0), balanslar
//   P&L (accrual): revenue = xizmat oyi charge'lari (finalAmount, WAIVED/CANCELLED emas)
//                  − xarajat (ACTIVE, date) − hisoblangan maosh (POSTED earning, earningMonth)
//   "Sof foyda" faqat P&L uchun; to'lov yig'indisi foyda EMAS.

import type { FinanceDb } from "../db";
import { accountsOverview } from "../accounts/balances";
import { monthEnd, monthStart, type YearMonth } from "../period";
import { collectionsTotal, refundsTotal } from "./collections";
import { expensesTotal } from "./expenses";
import { expectedRevenue } from "./debt";
import { ledgerRangeWhere, type ReportRange } from "./common";
import { salaryAccrued, salaryPaidTotal } from "./salary";

export interface CashFlowReport {
  range: ReportRange;
  inflowByType: Record<string, number>;
  outflowByType: Record<string, number>;
  /** transferlar ichki — netga kirmaydi */
  inflow: number;
  outflow: number;
  net: number;
  openingCash: number;
  closingCash: number;
}

export async function cashFlow(db: FinanceDb, r: ReportRange): Promise<CashFlowReport> {
  const rows = await db.financialTransaction.groupBy({ by: ["type", "direction"], where: ledgerRangeWhere(r), _sum: { amount: true } });
  const inflowByType: Record<string, number> = {};
  const outflowByType: Record<string, number> = {};
  for (const x of rows) {
    const target = x.direction === "IN" ? inflowByType : outflowByType;
    target[x.type] = (target[x.type] ?? 0) + (x._sum.amount ?? 0);
  }
  const external = (m: Record<string, number>) => Object.entries(m).filter(([t]) => t !== "TRANSFER_IN" && t !== "TRANSFER_OUT" && t !== "OPENING_BALANCE").reduce((a, [, v]) => a + v, 0);
  const inflow = external(inflowByType);
  const outflow = external(outflowByType);
  const accountsAtStart = await accountsOverview(db, { branchId: r.branchId, includeInactive: true, at: new Date(r.from.getTime() - 1) });
  const accountsAtEnd = await accountsOverview(db, { branchId: r.branchId, includeInactive: true, at: new Date(r.to.getTime() - 1) });
  return {
    range: r, inflowByType, outflowByType, inflow, outflow, net: inflow - outflow,
    openingCash: accountsAtStart.reduce((a, x) => a + x.balance, 0), closingCash: accountsAtEnd.reduce((a, x) => a + x.balance, 0),
  };
}

export interface ProfitAndLoss {
  month: YearMonth;
  /** accrual: xizmat oyi charge'lari */
  revenue: number;
  expenses: number;
  salaryAccrued: number;
  profit: number;
  /** cash: yig'ilgan − qaytarim − xarajat − to'langan maosh */
  cashCollected: number;
  cashRefunded: number;
  cashExpenses: number;
  cashSalaryPaid: number;
  cashNet: number;
}

export async function profitAndLoss(db: FinanceDb, ym: YearMonth, branchId?: string | null): Promise<ProfitAndLoss> {
  const r: ReportRange = { from: monthStart(ym), to: monthEnd(ym), branchId };
  const [revenue, exp, accrued, collected, refunded, paidSalary] = await Promise.all([
    expectedRevenue(db, ym, branchId), expensesTotal(db, r), salaryAccrued(db, ym, branchId), collectionsTotal(db, r), refundsTotal(db, r), salaryPaidTotal(db, r),
  ]);
  return {
    month: ym, revenue, expenses: exp.amount, salaryAccrued: accrued, profit: revenue - exp.amount - accrued,
    cashCollected: collected.amount, cashRefunded: refunded.amount, cashExpenses: exp.amount, cashSalaryPaid: paidSalary,
    cashNet: collected.amount - refunded.amount - exp.amount - paidSalary,
  };
}
