// Finance V2 — dashboard ko'rsatkichlari (reja §13): har biri alohida tushuncha.

import type { FinanceDb } from "../db";
import { accountsOverview } from "../accounts/balances";
import { monthEnd, monthStart, tashkentYearMonth } from "../period";
import { collectionsTotal, refundsTotal } from "./collections";
import { bucketKey, type ReportRange } from "./common";
import { expensesTotal } from "./expenses";
import { expectedRevenue, totalOutstandingDebt, totalStudentCredit } from "./debt";
import { cashFlow, profitAndLoss, type ProfitAndLoss } from "./cashflow";
import { salaryLiability, salaryPaidTotal } from "./salary";

export interface FinanceDashboard {
  todayCollected: number;
  monthCollected: number;
  monthRefunded: number;
  expectedRevenue: number;
  outstandingDebt: number;
  studentCredit: number;
  monthExpenses: number;
  salaryLiability: number;
  monthSalaryPaid: number;
  cashBalance: number;
  netCashFlow: number;
  pnl: ProfitAndLoss;
}

export async function financeDashboard(db: FinanceDb, opts: { branchId?: string | null; now?: Date } = {}): Promise<FinanceDashboard> {
  const now = opts.now ?? new Date();
  const ym = tashkentYearMonth(now);
  const month: ReportRange = { from: monthStart(ym), to: monthEnd(ym), branchId: opts.branchId };
  // Bugun (Tashkent kuni)
  const dayKey = bucketKey(now, "day");
  const dayStart = new Date(`${dayKey}T00:00:00+05:00`);
  const today: ReportRange = { from: dayStart, to: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000), branchId: opts.branchId };
  const [t, m, refunds, expected, debt, credit, exp, liability, paid, accounts, cf, pnl] = await Promise.all([
    collectionsTotal(db, today), collectionsTotal(db, month), refundsTotal(db, month), expectedRevenue(db, ym, opts.branchId), totalOutstandingDebt(db, opts.branchId),
    totalStudentCredit(db, opts.branchId), expensesTotal(db, month), salaryLiability(db), salaryPaidTotal(db, month), accountsOverview(db, { branchId: opts.branchId }), cashFlow(db, month), profitAndLoss(db, ym, opts.branchId),
  ]);
  return {
    todayCollected: t.amount, monthCollected: m.amount, monthRefunded: refunds.amount, expectedRevenue: expected, outstandingDebt: debt, studentCredit: credit,
    monthExpenses: exp.amount, salaryLiability: liability, monthSalaryPaid: paid, cashBalance: accounts.reduce((a, x) => a + x.balance, 0), netCashFlow: cf.net, pnl,
  };
}
