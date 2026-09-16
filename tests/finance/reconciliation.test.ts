import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ensureDefaultAccounts } from "@/lib/finance/accounts/accounts";
import { accountBalance, accountsOverview } from "@/lib/finance/accounts/balances";
import { createTransfer } from "@/lib/finance/accounts/transfers";
import { createExpense } from "@/lib/finance/expenses/expenses";
import { acceptPayment } from "@/lib/finance/payments/accept";
import { monthEnd, monthStart, type YearMonth } from "@/lib/finance/period";
import { createRefund } from "@/lib/finance/refunds/refund";
import { cashFlow, profitAndLoss } from "@/lib/finance/reports/cashflow";
import { collections, collectionsTotal, refundsTotal } from "@/lib/finance/reports/collections";
import { financeDashboard } from "@/lib/finance/reports/dashboard";
import { debtReport, studentBalancesReport, totalOutstandingDebt, totalStudentCredit } from "@/lib/finance/reports/debt";
import { expensesBy, expensesTotal } from "@/lib/finance/reports/expenses";
import { salaryPaidTotal, teacherEarningsReport, unpaidSalaryReport } from "@/lib/finance/reports/salary";
import { assignTeacher } from "@/lib/finance/salary/assignments";
import { approveSalaryPeriod, createPayout, recalculateSalaryPeriod } from "@/lib/finance/salary/periods";
import { createSalaryRule } from "@/lib/finance/salary/rules";
import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// HISOBOT RECONCILIATION — dashboard/hisobot raqamlari ↔ xom SQL (source of truth) ↔ buxgalteriya invariantlari.
// Cash flow (pul harakati) va P&L (accrual) aralashtirilmaydi; transfer daromad/xarajat emas.

const T = (iso: string) => new Date(iso);
const AUG: YearMonth = { year: 2026, month: 8 };
const OCT: YearMonth = { year: 2026, month: 10 };
const FEE = 1_000_000;

describe("reporting reconciliation", () => {
  let db: TestDb;
  let ids: { branch: string; group: string; teacher: string; director: string; cash: string; bank: string; students: string[] };
  let director: { userId: string; role: string; branchId: null };
  let n = 0;
  const key = (s: string) => `recon-${s}-${String(++n).padStart(4, "0")}`;
  const num = (v: unknown) => Number(v ?? 0);
  const sql = async (q: string) => num(Object.values((await db.prisma.$queryRawUnsafe<Record<string, unknown>[]>(q))[0] ?? {})[0]);
  const NOW = T("2026-10-25T05:00:00Z");
  const range = { from: monthStart(OCT), to: monthEnd(OCT) };

  beforeAll(async () => {
    db = createTestDb("reconciliation");
    const p = db.prisma;
    const branch = await p.branch.create({ data: { name: "Markaz" } });
    const d = await p.user.create({ data: { fullName: "Direktor", email: "d@t.local", passwordHash: "x", role: "DIRECTOR" } });
    const t = await p.user.create({ data: { fullName: "Akmal", email: "t@t.local", passwordHash: "x", role: "TEACHER", branchId: branch.id } });
    const program = await p.program.create({ data: { name: "P", monthlyFee: FEE } });
    const group = await p.group.create({ data: { name: "G", programId: program.id, branchId: branch.id, teacherId: t.id, createdAt: monthStart(AUG) } });
    const accounts = await ensureDefaultAccounts(p, branch.id, d.id);
    await createSalaryRule(p, { scope: "GLOBAL", component: "PERCENT", rateBp: 4000, effectiveFrom: monthStart(AUG), actorId: d.id });
    await assignTeacher(p, { groupId: group.id, teacherId: t.id, role: "MAIN", effectiveFrom: monthStart(AUG), actorId: d.id });
    const students: string[] = [];
    for (const nm of ["A", "B", "C"]) {
      const s = await p.student.create({ data: { fullName: nm, branchId: branch.id, eduStatus: "ACTIVE", createdAt: monthStart(OCT) } });
      await p.groupStudent.create({ data: { groupId: group.id, studentId: s.id, joinedAt: monthStart(OCT) } });
      students.push(s.id);
    }
    ids = { branch: branch.id, group: group.id, teacher: t.id, director: d.id, cash: accounts.find((a) => a.type === "MAIN_CASH")!.id, bank: accounts.find((a) => a.type === "BANK")!.id, students };
    director = { userId: d.id, role: "DIRECTOR", branchId: null };
    const pay = (sid: string, amount: number, at: string, method = "CASH") => acceptPayment(p, { studentId: sid, amount, method, receivedAt: T(at), purpose: "Kurs", idempotencyKey: key("pay") }, director, T(at));
    // A: to'liq; B: 1.3M (300k kredit); C: 400k qisman → qarz 600k
    const ra = await pay(students[0], FEE, "2026-10-05T05:00:00Z");
    await pay(students[1], 1_300_000, "2026-10-06T05:00:00Z", "CLICK");
    await pay(students[2], 400_000, "2026-10-07T05:00:00Z");
    await createRefund(p, { paymentId: ra.payment.id, amount: 200_000, reason: "Qaytarim", refundedAt: T("2026-10-10T05:00:00Z"), idempotencyKey: key("ref") }, director, T("2026-10-10T05:00:00Z"));
    await createExpense(p, { name: "Ijara", amount: 500_000, date: T("2026-10-12T05:00:00Z"), method: "CASH", branchId: branch.id, idempotencyKey: key("exp") }, director, T("2026-10-12T06:00:00Z"));
    await createTransfer(p, { fromAccountId: ids.cash, toAccountId: ids.bank, amount: 300_000, occurredAt: T("2026-10-15T05:00:00Z"), idempotencyKey: key("tr") }, director, T("2026-10-15T05:00:00Z"));
    const period = await recalculateSalaryPeriod(p, t.id, OCT, { userId: d.id });
    await approveSalaryPeriod(p, period.id, director);
    await createPayout(p, { salaryPeriodId: period.id, amount: 300_000, financialAccountId: ids.cash, paidAt: T("2026-10-20T05:00:00Z"), idempotencyKey: key("po") }, director, T("2026-10-20T05:00:00Z"));
  });

  afterAll(async () => {
    await db.dispose();
  });

  it("yig'imlar / qaytarim / qarz / kredit / xarajat / maosh — hisobot = SQL = dashboard", async () => {
    const p = db.prisma;
    const d = await financeDashboard(p, { now: NOW });
    const collected = await sql(`select coalesce(sum(amount),0) from Payment where postedAt is not null and legacyRole is null and receivedAt >= ${range.from.getTime()} and receivedAt < ${range.to.getTime()}`);
    expect(collected).toBe(2_700_000);
    expect((await collectionsTotal(p, range)).amount).toBe(collected);
    expect(d.monthCollected).toBe(collected);
    const refunded = await sql(`select coalesce(sum(amount),0) from Refund where status='DONE' and refundedAt >= ${range.from.getTime()} and refundedAt < ${range.to.getTime()}`);
    expect(refunded).toBe(200_000);
    expect((await refundsTotal(p, range)).amount).toBe(refunded);
    expect(d.monthRefunded).toBe(refunded);
    // Qarz = Σ(final − net allocation) ochiq charge'lar; A: 200k qayta ochildi, C: 600k
    const debtSql = await sql(`select coalesce(sum(c.finalAmount - coalesce((select sum(case when a.kind='ALLOCATION' then a.amount else -a.amount end) from PaymentAllocation a where a.chargeId=c.id),0)),0) from StudentCharge c where c.status in ('OPEN','PARTIALLY_PAID')`);
    expect(debtSql).toBe(800_000);
    expect(await totalOutstandingDebt(p)).toBe(debtSql);
    expect(d.outstandingDebt).toBe(debtSql);
    expect((await debtReport(p)).total).toBe(debtSql);
    // Kredit = Σ(to'lov − net allocation − qaytarim) > 0; B: 300k
    const creditSql = await sql(`select coalesce(sum(u),0) from (select p.amount - coalesce((select sum(case when a.kind='ALLOCATION' then a.amount else -a.amount end) from PaymentAllocation a where a.paymentId=p.id),0) - coalesce((select sum(r.amount) from Refund r where r.originalPaymentId=p.id and r.status='DONE'),0) as u from Payment p where p.postedAt is not null and p.status='PAID' and p.legacyRole is null) where u > 0`);
    expect(creditSql).toBe(300_000);
    expect(await totalStudentCredit(p)).toBe(creditSql);
    expect(d.studentCredit).toBe(creditSql);
    const bal = await studentBalancesReport(p, { onlyNonZero: true });
    expect(bal.reduce((a, r) => a + r.debt, 0)).toBe(debtSql);
    expect(bal.reduce((a, r) => a + r.credit, 0)).toBe(creditSql);
    const expensesSql = await sql(`select coalesce(sum(amount),0) from Expense where status='ACTIVE' and reversalOfId is null and postedAt is not null and date >= ${range.from.getTime()} and date < ${range.to.getTime()}`);
    expect(expensesSql).toBe(500_000);
    expect((await expensesTotal(p, range)).amount).toBe(expensesSql);
    expect((await expensesBy(p, range, "category")).reduce((a, r) => a + r.amount, 0)).toBe(expensesSql);
    expect(d.monthExpenses).toBe(expensesSql);
    // Maosh: hisoblangan (POSTED earning'lar, okt) = 2.4M × 40% − qaytarim tuzatishi (80k) = 880k; to'langan 300k; majburiyat = qoldiq
    const accrued = await sql(`select coalesce(sum(amount),0) from TeacherEarning where status='POSTED' and earningYear=2026 and earningMonth=10`);
    expect(accrued).toBe(880_000);
    expect((await teacherEarningsReport(p, OCT)).reduce((a, r) => a + r.total, 0)).toBe(accrued);
    const paid = await sql(`select coalesce(sum(amount),0) from SalaryPayout where status='DONE'`);
    expect(paid).toBe(300_000);
    expect(await salaryPaidTotal(p, range)).toBe(paid);
    expect(d.monthSalaryPaid).toBe(paid);
    expect((await unpaidSalaryReport(p)).total).toBe(accrued - paid);
    expect(d.salaryLiability).toBe(accrued - paid);
    expect(d.pnl.salaryAccrued).toBe(accrued);
  });

  it("kassa: balans = ΣIN − ΣOUT (har kassa), dashboard cashBalance = Σ balanslar; cash flow ≠ P&L; transfer hech qaysiga kirmaydi", async () => {
    const p = db.prisma;
    const d = await financeDashboard(p, { now: NOW });
    let total = 0;
    for (const acc of await p.financialAccount.findMany({ select: { id: true } })) {
      const inn = await sql(`select coalesce(sum(amount),0) from FinancialTransaction where accountId='${acc.id}' and direction='IN'`);
      const out = await sql(`select coalesce(sum(amount),0) from FinancialTransaction where accountId='${acc.id}' and direction='OUT'`);
      expect(await accountBalance(p, acc.id)).toBe(inn - out);
      total += inn - out;
    }
    // cash: +1M +400k (CASH to'lovlar) −200k qaytarim −500k xarajat −300k transfer −300k payout = 100k; click: +1.3M; bank: +300k
    expect(await accountBalance(p, ids.cash)).toBe(100_000);
    expect(await accountBalance(p, ids.bank)).toBe(300_000);
    expect(total).toBe(1_700_000);
    expect((await accountsOverview(p, {})).reduce((a, r) => a + r.balance, 0)).toBe(total);
    expect(d.cashBalance).toBe(total);
    const cf = await cashFlow(p, range);
    expect(cf.inflow).toBe(2_700_000); // faqat tashqi kirim (transfer IN yo'q)
    expect(cf.outflow).toBe(200_000 + 500_000 + 300_000); // qaytarim + xarajat + payout (transfer OUT yo'q)
    expect(cf.net).toBe(1_700_000);
    expect(cf.inflowByType.TRANSFER_IN).toBe(300_000); // ko'rinadi, lekin net'ga kirmaydi
    expect(cf.closingCash - cf.openingCash).toBe(cf.net); // opening + net = closing (transfer ichki, yig'indi o'zgarmaydi)
    expect(d.netCashFlow).toBe(cf.net);
    const pnl = await profitAndLoss(p, OCT);
    // Accrual: daromad = oktabr charge'lari yakuniy (3 × 1M), xarajat 500k, maosh 880k
    expect(pnl.revenue).toBe(3 * FEE);
    expect(pnl.expenses).toBe(500_000);
    expect(pnl.salaryAccrued).toBe(880_000);
    expect(pnl.profit).toBe(3 * FEE - 500_000 - 880_000);
    expect(pnl.cashNet).toBe(2_700_000 - 200_000 - 500_000 - 300_000); // cash: transfer yo'q
    expect(pnl.profit).not.toBe(cf.net); // aralashtirilmagan
    expect(JSON.stringify(d.pnl)).toBe(JSON.stringify(pnl));
    // Yig'imlar usul bo'yicha = jami
    const byMethod = await collections(p, range, "method");
    expect(byMethod.reduce((a, r) => a + r.amount, 0)).toBe(2_700_000);
    expect(byMethod.find((r) => r.key === "CLICK")?.amount).toBe(1_300_000);
  });
});
