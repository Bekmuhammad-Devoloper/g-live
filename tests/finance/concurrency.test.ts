import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ensureDefaultAccounts } from "@/lib/finance/accounts/accounts";
import { accountBalance } from "@/lib/finance/accounts/balances";
import { createTransfer } from "@/lib/finance/accounts/transfers";
import { syncStudentBilling } from "@/lib/finance/billing/sync";
import { withFinanceTx } from "@/lib/finance/db";
import { createExpense } from "@/lib/finance/expenses/expenses";
import { acceptPayment } from "@/lib/finance/payments/accept";
import { monthStart, type YearMonth } from "@/lib/finance/period";
import { createRefund } from "@/lib/finance/refunds/refund";
import { assignTeacher } from "@/lib/finance/salary/assignments";
import { approveSalaryPeriod, createPayout, recalculateSalaryPeriod } from "@/lib/finance/salary/periods";
import { createSalaryRule } from "@/lib/finance/salary/rules";
import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// PARALLEL SO'ROVLAR — dublikat moliyaviy fakt 0, over-allocation 0, over-refund 0, over-payout 0, ikki ledger 0.
// SQLite bitta yozuvchi: parallel tranzaksiyalar navbatga tushadi (busy → withFinanceTx qayta urinadi);
// idempotency kalitlari + DB unique'lar dublikatni to'sadi; qoldiq tekshiruvlari tranzaksiya ichida.

const T = (iso: string) => new Date(iso);
const AUG: YearMonth = { year: 2026, month: 8 };
const OCT: YearMonth = { year: 2026, month: 10 };
const NOV: YearMonth = { year: 2026, month: 11 };
const FEE = 1_000_000;
const settle = <T,>(ps: Promise<T>[]) => Promise.allSettled(ps);

describe("concurrency / double action", () => {
  let db: TestDb;
  let ids: { branch: string; program: string; group: string; teacher: string; director: string; cash: string; bank: string };
  let director: { userId: string; role: string; branchId: null };
  let n = 0;
  const key = (s: string) => `cc-${s}-${String(++n).padStart(4, "0")}`;

  async function mkStudent(name: string, joinedAt = monthStart(OCT)) {
    const s = await db.prisma.student.create({ data: { fullName: name, branchId: ids.branch, eduStatus: "ACTIVE", createdAt: joinedAt } });
    await db.prisma.groupStudent.create({ data: { groupId: ids.group, studentId: s.id, joinedAt } });
    return s;
  }
  const pay = (studentId: string, amount: number, at: string, k: string) =>
    acceptPayment(db.prisma, { studentId, amount, method: "CASH", receivedAt: T(at), purpose: "Kurs", idempotencyKey: k }, director, T(at));

  beforeAll(async () => {
    db = createTestDb("concurrency");
    const p = db.prisma;
    const branch = await p.branch.create({ data: { name: "Markaz" } });
    const d = await p.user.create({ data: { fullName: "Direktor", email: "d@t.local", passwordHash: "x", role: "DIRECTOR" } });
    const t = await p.user.create({ data: { fullName: "Akmal", email: "t@t.local", passwordHash: "x", role: "TEACHER", branchId: branch.id } });
    const program = await p.program.create({ data: { name: "P", monthlyFee: FEE } });
    const group = await p.group.create({ data: { name: "G", programId: program.id, branchId: branch.id, teacherId: t.id, createdAt: monthStart(AUG) } });
    const accounts = await ensureDefaultAccounts(p, branch.id, d.id);
    await createSalaryRule(p, { scope: "GLOBAL", component: "PERCENT", rateBp: 4000, effectiveFrom: monthStart(AUG), actorId: d.id });
    await assignTeacher(p, { groupId: group.id, teacherId: t.id, role: "MAIN", effectiveFrom: monthStart(AUG), actorId: d.id });
    ids = { branch: branch.id, program: program.id, group: group.id, teacher: t.id, director: d.id, cash: accounts.find((a) => a.type === "MAIN_CASH")!.id, bank: accounts.find((a) => a.type === "BANK")!.id };
    director = { userId: d.id, role: "DIRECTOR", branchId: null };
  });

  afterAll(async () => {
    await db.dispose();
  });

  it("bir to'lov bir vaqtda 5 marta (bir idempotency kalit) → 1 Payment, 1 ledger, 1 allocation, 1 earning", async () => {
    const p = db.prisma;
    const s = await mkStudent("Dup");
    const k = key("dup");
    const results = await settle(Array.from({ length: 5 }, () => pay(s.id, FEE, "2026-10-05T05:00:00Z", k)));
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(5);
    expect(await p.payment.count({ where: { studentId: s.id } })).toBe(1);
    const pid = (await p.payment.findFirstOrThrow({ where: { studentId: s.id } })).id;
    expect(await p.financialTransaction.count({ where: { referenceType: "Payment", referenceId: pid } })).toBe(1);
    expect(await p.paymentAllocation.count({ where: { paymentId: pid } })).toBe(1);
    expect(await p.teacherEarning.count({ where: { sourcePaymentId: pid } })).toBe(1);
  });

  it("bir charge'ga parallel taqsimot (600k + 600k → 1M charge): Σallocation = 1M, kredit 200k, over-allocation 0", async () => {
    const p = db.prisma;
    const s = await mkStudent("Par");
    const results = await settle([pay(s.id, 600_000, "2026-10-05T05:00:00Z", key("a")), pay(s.id, 600_000, "2026-10-05T05:00:01Z", key("b"))]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    const charge = await p.studentCharge.findFirstOrThrow({ where: { studentId: s.id, serviceMonth: 10 } });
    const agg = await p.paymentAllocation.aggregate({ _sum: { amount: true }, where: { chargeId: charge.id, kind: "ALLOCATION" } });
    expect(agg._sum.amount).toBe(FEE);
    const pays = await p.payment.findMany({ where: { studentId: s.id } });
    expect(pays.reduce((a, x) => a + x.amount, 0)).toBe(1_200_000);
    expect(await p.studentCharge.count({ where: { studentId: s.id } })).toBe(1); // parallel ensureMonthlyCharges dublikat yaratmadi
    const earnings = await p.teacherEarning.aggregate({ _sum: { amount: true }, where: { studentId: s.id } });
    expect(earnings._sum.amount).toBe(400_000); // faqat taqsimlangan 1M dan
  });

  it("bir kreditni parallel qo'llash (3× billing sync): bitta CREDIT_APPLY, charge ortiqcha to'lanmaydi", async () => {
    const p = db.prisma;
    const s = await mkStudent("Cred", monthStart(OCT));
    await pay(s.id, 2 * FEE, "2026-10-05T05:00:00Z", key("cred")); // 1M oktabr + 1M kredit
    const results = await settle(Array.from({ length: 3 }, () => withFinanceTx(p, (tx) => syncStudentBilling(tx, { studentId: s.id, upTo: NOV, actorId: ids.director, now: T("2026-11-02T05:00:00Z") }))));
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    const nov = await p.studentCharge.findMany({ where: { studentId: s.id, serviceMonth: 11 } });
    expect(nov).toHaveLength(1);
    const agg = await p.paymentAllocation.aggregate({ _sum: { amount: true }, _count: { _all: true }, where: { chargeId: nov[0].id } });
    expect(agg).toMatchObject({ _sum: { amount: FEE }, _count: { _all: 1 } });
  });

  it("parallel qaytarim: bir kalit ×3 → 1 refund; 700k + 700k (1M to'lov) → biri rad, Σ ≤ 1M", async () => {
    const p = db.prisma;
    const s = await mkStudent("Ref");
    const r = await pay(s.id, FEE, "2026-10-05T05:00:00Z", key("ref"));
    const k = key("ref-same");
    const same = await settle(Array.from({ length: 3 }, () => createRefund(p, { paymentId: r.payment.id, amount: 100_000, reason: "Qaytarim", refundedAt: T("2026-10-06T05:00:00Z"), idempotencyKey: k }, director, T("2026-10-06T05:00:00Z"))));
    expect(same.every((x) => x.status === "fulfilled")).toBe(true);
    expect(await p.refund.count({ where: { originalPaymentId: r.payment.id } })).toBe(1);
    const big = await settle([700_000, 700_000].map((amt) => createRefund(p, { paymentId: r.payment.id, amount: amt, reason: "Katta qaytarim", refundedAt: T("2026-10-07T05:00:00Z"), idempotencyKey: key("ref-big") }, director, T("2026-10-07T05:00:00Z"))));
    expect(big.filter((x) => x.status === "fulfilled").length).toBe(1);
    const sum = await p.refund.aggregate({ _sum: { amount: true }, where: { originalPaymentId: r.payment.id, status: "DONE" } });
    expect(sum._sum.amount).toBe(800_000);
    expect(sum._sum.amount!).toBeLessThanOrEqual(FEE);
  });

  it("bir davrni parallel tasdiqlash (3×) → bitta APPROVED, bitta APPROVE audit; parallel payout: bir kalit → 1, 300k+300k (qoldiq 400k) → biri rad", async () => {
    const p = db.prisma;
    const s = await mkStudent("Sal");
    await pay(s.id, FEE, "2026-10-10T05:00:00Z", key("sal"));
    const period = await recalculateSalaryPeriod(p, ids.teacher, OCT, { userId: ids.director });
    const approvals = await settle(Array.from({ length: 3 }, () => withFinanceTx(p, (tx) => approveSalaryPeriod(tx, period.id, director))));
    expect(approvals.filter((x) => x.status === "fulfilled").length).toBe(1);
    expect((await p.salaryPeriod.findUniqueOrThrow({ where: { id: period.id } })).status).toBe("APPROVED");
    expect(await p.auditLog.count({ where: { entityType: "SalaryPeriod", entityId: period.id, action: "APPROVE" } })).toBe(1);
    const remaining = (await p.salaryPeriod.findUniqueOrThrow({ where: { id: period.id } })).remainingAmount;
    const k = key("po-same");
    const same = await settle(Array.from({ length: 3 }, () => createPayout(p, { salaryPeriodId: period.id, amount: 100_000, financialAccountId: ids.cash, paidAt: T("2026-11-01T05:00:00Z"), idempotencyKey: k }, director, T("2026-11-01T05:00:00Z"))));
    expect(same.every((x) => x.status === "fulfilled")).toBe(true);
    expect(await p.salaryPayout.count({ where: { salaryPeriodId: period.id } })).toBe(1);
    const left = remaining - 100_000;
    const half = Math.ceil(left / 2) + 1; // ikkitasi birga qoldiqdan oshadi
    const race = await settle([half, half].map(() => createPayout(p, { salaryPeriodId: period.id, amount: half, financialAccountId: ids.cash, paidAt: T("2026-11-01T06:00:00Z"), idempotencyKey: key("po-race") }, director, T("2026-11-01T06:00:00Z"))));
    expect(race.filter((x) => x.status === "fulfilled").length).toBe(1);
    const paid = await p.salaryPayout.aggregate({ _sum: { amount: true }, where: { salaryPeriodId: period.id, status: "DONE" } });
    expect(paid._sum.amount!).toBeLessThanOrEqual(remaining);
    expect(await p.financialTransaction.count({ where: { referenceType: "SalaryPayout" } })).toBe(await p.salaryPayout.count({ where: { salaryPeriodId: period.id } }));
  });

  it("parallel transfer (bir kalit ×3) → 1 transfer, 2 ledger; parallel xarajat (bir kalit ×3) → 1 xarajat, 1 ledger; balans = ΣIN − ΣOUT", async () => {
    const p = db.prisma;
    const k = key("tr");
    const tr = await settle(Array.from({ length: 3 }, () => createTransfer(p, { fromAccountId: ids.cash, toAccountId: ids.bank, amount: 50_000, occurredAt: T("2026-10-20T05:00:00Z"), idempotencyKey: k }, director, T("2026-10-20T05:00:00Z"))));
    expect(tr.every((x) => x.status === "fulfilled")).toBe(true);
    expect(await p.transfer.count({ where: { idempotencyKey: k } })).toBe(1);
    const trId = (await p.transfer.findUniqueOrThrow({ where: { idempotencyKey: k } })).id;
    expect(await p.financialTransaction.count({ where: { referenceType: "Transfer", referenceId: trId } })).toBe(2);
    const ek = key("exp");
    const ex = await settle(Array.from({ length: 3 }, () => createExpense(p, { name: "Ijara", amount: 30_000, date: T("2026-10-21T05:00:00Z"), method: "CASH", branchId: ids.branch, idempotencyKey: ek }, director, T("2026-10-21T06:00:00Z"))));
    expect(ex.every((x) => x.status === "fulfilled")).toBe(true);
    expect(await p.expense.count({ where: { idempotencyKey: ek } })).toBe(1);
    const exId = (await p.expense.findUniqueOrThrow({ where: { idempotencyKey: ek } })).id;
    expect(await p.financialTransaction.count({ where: { referenceType: "Expense", referenceId: exId } })).toBe(1);
    for (const acc of [ids.cash, ids.bank]) {
      const inn = await p.financialTransaction.aggregate({ _sum: { amount: true }, where: { accountId: acc, direction: "IN" } });
      const out = await p.financialTransaction.aggregate({ _sum: { amount: true }, where: { accountId: acc, direction: "OUT" } });
      expect(await accountBalance(p, acc)).toBe((inn._sum.amount ?? 0) - (out._sum.amount ?? 0));
    }
    // Ledger idempotency kalitlari noyob (DB unique) — dublikat ledger 0
    const dup = await p.$queryRawUnsafe<{ n: number | bigint }[]>(`select count(*) n from (select idempotencyKey from FinancialTransaction group by idempotencyKey having count(*) > 1)`);
    expect(Number(dup[0].n)).toBe(0);
  });
});
