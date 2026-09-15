import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accountForMethod } from "@/lib/finance/accounts/accounts";
import { createExpense } from "@/lib/finance/expenses/expenses";
import { acceptPayment } from "@/lib/finance/payments/accept";
import { monthStart } from "@/lib/finance/period";
import { createRefund } from "@/lib/finance/refunds/refund";
import { cashFlow, profitAndLoss } from "@/lib/finance/reports/cashflow";
import { collections, collectionsTotal, revenueBy } from "@/lib/finance/reports/collections";
import { monthRange } from "@/lib/finance/reports/common";
import { financeDashboard } from "@/lib/finance/reports/dashboard";
import { debtReport, studentBalancesReport } from "@/lib/finance/reports/debt";
import { expensesBy } from "@/lib/finance/reports/expenses";
import { payoutsReport, salaryPeriodsReport, teacherEarningsReport, unpaidSalaryReport } from "@/lib/finance/reports/salary";
import { syncGroupTeacherAssignment } from "@/lib/finance/salary/assignments";
import { approveSalaryPeriod, createPayout, recalculateSalaryPeriod } from "@/lib/finance/salary/periods";
import { createSalaryRule } from "@/lib/finance/salary/rules";
import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// Phase 11 — hisobotlar bitta stsenariyda: 2 o'quvchi, to'lovlar (CASH/CLICK), qaytarim, xarajat,
// maosh (approve + qisman payout). Cash Flow va P&L ALOHIDA va farqli.

const T = (iso: string) => new Date(iso);
const CUTOVER = T("2026-07-31T19:00:00Z");
const OCT = { year: 2026, month: 10 };

describe("finance reports (Phase 11)", () => {
  let db: TestDb;
  let ids: { branch: string; teacher: string; s1: string; s2: string; director: string; cash: string; category: string };
  let director: { userId: string; role: string; branchId: null };

  beforeAll(async () => {
    db = createTestDb("reports");
    const p = db.prisma;
    const branch = await p.branch.create({ data: { name: "Markaz" } });
    const d = await p.user.create({ data: { fullName: "Direktor", email: "d@t.local", passwordHash: "x", role: "DIRECTOR" } });
    const teacher = await p.user.create({ data: { fullName: "Akmal", email: "a@t.local", passwordHash: "x", role: "TEACHER", branchId: branch.id } });
    const prog = await p.program.create({ data: { name: "IELTS", monthlyFee: 1_000_000 } });
    const g = await p.group.create({ data: { name: "IELTS-12", programId: prog.id, branchId: branch.id, teacherId: teacher.id, createdAt: T("2026-08-01T05:00:00Z") } });
    await syncGroupTeacherAssignment(p, g.id, { at: T("2026-08-01T05:00:00Z"), cutoverAt: CUTOVER });
    await createSalaryRule(p, { scope: "GLOBAL", component: "PERCENT", rateBp: 4000, effectiveFrom: monthStart({ year: 2026, month: 8 }) });
    const s1 = await p.student.create({ data: { fullName: "Ali", branchId: branch.id, eduStatus: "ACTIVE", createdAt: T("2026-10-01T05:00:00Z") } });
    const s2 = await p.student.create({ data: { fullName: "Vali", branchId: branch.id, eduStatus: "ACTIVE", createdAt: T("2026-10-01T05:00:00Z") } });
    await p.groupStudent.create({ data: { groupId: g.id, studentId: s1.id, joinedAt: T("2026-10-01T05:00:00Z") } });
    await p.groupStudent.create({ data: { groupId: g.id, studentId: s2.id, joinedAt: T("2026-10-01T05:00:00Z") } });
    const cash = await accountForMethod(p, branch.id, "CASH");
    const cat = await p.expenseCategory.create({ data: { name: "Ijara" } });
    ids = { branch: branch.id, teacher: teacher.id, s1: s1.id, s2: s2.id, director: d.id, cash: cash.id, category: cat.id };
    director = { userId: d.id, role: "DIRECTOR", branchId: null };
    // Oktabr: s1 1M CASH (5-okt), s2 1.5M CLICK (10-okt, 500k kredit); s1 dan 200k qaytarim (20-okt); ijara 300k (3-okt)
    await acceptPayment(p, { studentId: s1.id, amount: 1_000_000, method: "CASH", receivedAt: T("2026-10-05T05:00:00Z"), purpose: "Kurs", idempotencyKey: "rep-pay-0001" }, director, T("2026-10-05T05:00:00Z"));
    const p2 = await acceptPayment(p, { studentId: s2.id, amount: 1_500_000, method: "CLICK", receivedAt: T("2026-10-10T05:00:00Z"), purpose: "Kurs", idempotencyKey: "rep-pay-0002" }, director, T("2026-10-10T05:00:00Z"));
    void p2;
    const pay1 = await p.payment.findFirstOrThrow({ where: { idempotencyKey: "rep-pay-0001" } });
    await createRefund(p, { paymentId: pay1.id, amount: 200_000, reason: "Qisman qaytarim", refundedAt: T("2026-10-20T05:00:00Z"), idempotencyKey: "rep-refund-0001" }, director, T("2026-10-20T05:00:00Z"));
    await createExpense(p, { name: "Ijara", amount: 300_000, date: T("2026-10-03T05:00:00Z"), method: "CASH", categoryId: cat.id, branchId: branch.id, idempotencyKey: "rep-expense-0001" }, director, T("2026-10-03T06:00:00Z"));
    // Maosh: oktabr 40% × (1M + 1M) = 800k − 80k adjustment = 720k; approve; 500k payout 1-noy
    await recalculateSalaryPeriod(p, teacher.id, OCT, { userId: d.id });
    const period = await approveSalaryPeriod(p, (await p.salaryPeriod.findFirstOrThrow({ where: { teacherId: teacher.id, year: 2026, month: 10 } })).id, director);
    await createPayout(p, { salaryPeriodId: period.id, amount: 500_000, financialAccountId: cash.id, paidAt: T("2026-11-01T05:00:00Z"), idempotencyKey: "rep-payout-0001" }, director, T("2026-11-01T05:00:00Z"));
  });

  afterAll(async () => {
    await db.dispose();
  });

  it("yig'imlar: jami 2.5M; usul bo'yicha CASH 1M / CLICK 1.5M; kun bo'yicha; daromad kurs/guruh/o'qituvchi = taqsimlangan 2M", async () => {
    const r = monthRange(OCT, ids.branch);
    expect(await collectionsTotal(db.prisma, r)).toEqual({ amount: 2_500_000, count: 2 });
    expect((await collections(db.prisma, r, "method")).map((x) => [x.key, x.amount])).toEqual([["CASH", 1_000_000], ["CLICK", 1_500_000]]);
    expect((await collections(db.prisma, r, "day")).map((x) => x.key)).toEqual(["2026-10-05", "2026-10-10"]);
    expect((await collections(db.prisma, r, "month"))[0]).toMatchObject({ key: "2026-10", amount: 2_500_000, count: 2 });
    // taqsimlangan: s1 1M − 200k reversal = 800k, s2 1M → 1.8M (500k kredit kirmaydi)
    expect((await revenueBy(db.prisma, r, "program"))[0]).toMatchObject({ label: "IELTS", amount: 1_800_000 });
    expect((await revenueBy(db.prisma, r, "group"))[0]).toMatchObject({ label: "IELTS-12", amount: 1_800_000 });
    expect((await revenueBy(db.prisma, r, "teacher"))[0]).toMatchObject({ label: "Akmal", amount: 2_000_000 }); // POSTED commission allocation'lari (reversal earning'i allocation emas)
  });

  it("xarajatlar kategoriya bo'yicha; qarz hisoboti; o'quvchi balanslari", async () => {
    const r = monthRange(OCT, ids.branch);
    expect((await expensesBy(db.prisma, r, "category"))[0]).toMatchObject({ label: "Ijara", amount: 300_000 });
    const debt = await debtReport(db.prisma, { branchId: ids.branch, at: T("2026-10-25T05:00:00Z") });
    expect(debt.total).toBe(200_000); // s1: 200k qaytarilgan → qarz qayta ochildi
    expect(debt.rows[0]).toMatchObject({ fullName: "Ali", debt: 200_000, bucket: "8-30" });
    const balances = await studentBalancesReport(db.prisma, { branchId: ids.branch });
    expect(balances.find((b) => b.fullName === "Ali")).toMatchObject({ debt: 200_000, credit: 0, net: -200_000 });
    expect(balances.find((b) => b.fullName === "Vali")).toMatchObject({ debt: 0, credit: 500_000, net: 500_000 });
  });

  it("maosh hisobotlari: earning'lar (commission 800k, adjustment −80k), davr APPROVED → PARTIALLY_PAID, to'lanmagan 220k, to'lovlar", async () => {
    const te = await teacherEarningsReport(db.prisma, OCT, ids.branch);
    expect(te[0]).toMatchObject({ teacherName: "Akmal", commission: 800_000, adjustment: -80_000, total: 720_000, needsReview: 0 });
    const periods = await salaryPeriodsReport(db.prisma, { ym: OCT });
    expect(periods[0]).toMatchObject({ status: "PARTIALLY_PAID", gross: 720_000, paid: 500_000, remaining: 220_000 });
    expect((await unpaidSalaryReport(db.prisma)).total).toBe(220_000);
    const payouts = await payoutsReport(db.prisma, monthRange({ year: 2026, month: 11 }));
    expect(payouts.total).toBe(500_000);
    expect(payouts.byAccount[0].amount).toBe(500_000);
  });

  it("Cash Flow ≠ P&L: oktabr cash net = 2.5M − 200k − 300k = 2.0M; P&L = 2M revenue − 300k − 720k = 980k", async () => {
    const cf = await cashFlow(db.prisma, monthRange(OCT, ids.branch));
    expect(cf.inflowByType.STUDENT_PAYMENT).toBe(2_500_000);
    expect(cf.outflowByType.REFUND).toBe(200_000);
    expect(cf.outflowByType.EXPENSE).toBe(300_000);
    expect(cf.net).toBe(2_000_000);
    expect(cf.closingCash).toBe(2_000_000); // kassa 1M − 200k − 300k = 500k, CLICK 1.5M
    const pnl = await profitAndLoss(db.prisma, OCT, ids.branch);
    expect(pnl).toMatchObject({ revenue: 2_000_000, expenses: 300_000, salaryAccrued: 720_000, profit: 980_000, cashCollected: 2_500_000, cashRefunded: 200_000, cashSalaryPaid: 0, cashNet: 2_000_000 });
    expect(pnl.profit).not.toBe(pnl.cashNet);
    const dash = await financeDashboard(db.prisma, { branchId: ids.branch, now: T("2026-10-05T10:00:00Z") });
    expect(dash).toMatchObject({ todayCollected: 1_000_000, monthCollected: 2_500_000, monthRefunded: 200_000, expectedRevenue: 2_000_000, outstandingDebt: 200_000, studentCredit: 500_000, monthExpenses: 300_000, salaryLiability: 220_000, monthSalaryPaid: 0, cashBalance: 1_500_000, netCashFlow: 2_000_000 });
    // noyabr: maosh to'lovi 500k
    const nov = await financeDashboard(db.prisma, { branchId: ids.branch, now: T("2026-11-02T10:00:00Z") });
    expect(nov.monthSalaryPaid).toBe(500_000);
    expect(nov.cashBalance).toBe(1_500_000);
  });
});
