import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTransfer } from "@/lib/finance/accounts/transfers";
import { ensureDefaultAccounts } from "@/lib/finance/accounts/accounts";
import { FinanceError } from "@/lib/finance/errors";
import { createExpense, reverseExpense } from "@/lib/finance/expenses/expenses";
import { acceptPayment } from "@/lib/finance/payments/accept";
import { FINANCE_PERMISSIONS, assertBranchAccess, assertSalaryView, branchScope, financePermissionsOf, hasFinancePermission, requireFinancePermission, type FinancePermission } from "@/lib/finance/permissions";
import { createRefund, reversePayment } from "@/lib/finance/refunds/refund";
import { createManualEarning, rejectReviewedEarning } from "@/lib/finance/salary/earnings";
import { approveSalaryPeriod, closeSalaryPeriod, createPayout, recalculateSalaryPeriod, reopenSalaryPeriod } from "@/lib/finance/salary/periods";
import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// Phase 13 — RBAC FINAL matritsa (reja §16): har rol × har ruxsat aniq kutilgan qiymat bilan;
// filial cheklovi (MANAGER); TEACHER faqat o'z maoshi; dvigatel kirish nuqtalari ruxsatsiz rolni SERVER SIDE rad etadi.

const T = (iso: string) => new Date(iso);
const ALL = [...FINANCE_PERMISSIONS];
const drop = (...d: FinancePermission[]) => ALL.filter((p) => !d.includes(p));

/** FINAL matritsa — kutilgan ruxsatlar (rol → ruxsatlar) */
const EXPECTED: Record<string, FinancePermission[]> = {
  DIRECTOR: ALL,
  DEPUTY_DIRECTOR: drop("FINANCE_PERIOD_REOPEN"),
  ACCOUNTANT: drop("SALARY_RULE_MANAGE", "SALARY_APPROVE", "FINANCE_PERIOD_REOPEN"),
  MANAGER: ["FINANCE_VIEW", "FINANCE_REPORT_VIEW", "PAYMENT_CREATE", "EXPENSE_VIEW", "EXPENSE_CREATE", "FINANCIAL_ACCOUNT_VIEW"],
  ADMIN: ["PAYMENT_CREATE"],
  TEACHER: ["SALARY_VIEW"],
  OPERATOR: [],
  ROP: [],
  STUDENT: [],
  PARENT: [],
};

describe("RBAC matrix (Phase 13)", () => {
  it("har rol × har ruxsat FINAL matritsaga mos (16 ruxsat × 10 rol)", () => {
    expect(FINANCE_PERMISSIONS.length).toBe(16);
    for (const [role, perms] of Object.entries(EXPECTED)) {
      for (const perm of ALL) {
        expect({ role, perm, ok: hasFinancePermission(role, perm) }).toEqual({ role, perm, ok: perms.includes(perm) });
      }
      expect(financePermissionsOf(role).sort()).toEqual([...perms].sort());
    }
    expect(hasFinancePermission("NOMALUM", "FINANCE_VIEW")).toBe(false);
  });

  it("requireFinancePermission: ruxsatsiz → FinanceError('forbidden') (rol va ruxsat details bilan)", () => {
    expect(() => requireFinancePermission({ role: "DIRECTOR" }, "FINANCE_PERIOD_REOPEN")).not.toThrow();
    let err: unknown;
    try { requireFinancePermission({ role: "ACCOUNTANT" }, "SALARY_APPROVE"); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(FinanceError);
    expect((err as FinanceError).code).toBe("forbidden");
    expect((err as FinanceError).details).toEqual({ role: "ACCOUNTANT", perm: "SALARY_APPROVE" });
  });

  it("filial cheklovi: faqat MANAGER; filialsiz MANAGER bloklanadi; boshqa filial → forbidden", () => {
    expect(branchScope({ role: "DIRECTOR", branchId: null })).toBeNull();
    expect(branchScope({ role: "ACCOUNTANT", branchId: "b1" })).toBeNull();
    expect(branchScope({ role: "MANAGER", branchId: "b1" })).toEqual({ branchId: "b1" });
    expect(branchScope({ role: "MANAGER", branchId: null })).toEqual({ branchId: "" });
    expect(() => assertBranchAccess({ role: "MANAGER", branchId: "b1" }, "b1")).not.toThrow();
    expect(() => assertBranchAccess({ role: "MANAGER", branchId: "b1" }, "b2")).toThrow(FinanceError);
    expect(() => assertBranchAccess({ role: "MANAGER", branchId: "b1" }, null)).toThrow(FinanceError);
    expect(() => assertBranchAccess({ role: "MANAGER", branchId: null }, "b1")).toThrow(FinanceError);
    expect(() => assertBranchAccess({ role: "DIRECTOR", branchId: null }, "b2")).not.toThrow();
  });

  it("TEACHER faqat o'z maoshi; SALARY_VIEW bo'lmagan rol hech kimni ko'rmaydi", () => {
    expect(() => assertSalaryView({ role: "TEACHER", userId: "t1" }, "t1")).not.toThrow();
    expect(() => assertSalaryView({ role: "TEACHER", userId: "t1" }, "t2")).toThrow(/o'z maoshingizni/);
    expect(() => assertSalaryView({ role: "ACCOUNTANT", userId: "a" }, "t2")).not.toThrow();
    expect(() => assertSalaryView({ role: "MANAGER", userId: "m" }, "t2")).toThrow(FinanceError);
    expect(() => assertSalaryView({ role: "OPERATOR", userId: "o" }, "t2")).toThrow(FinanceError);
  });
});

describe("engine entry points reject unauthorized roles server-side (Phase 13)", () => {
  let db: TestDb;
  let ids: { branch: string; branch2: string; student: string; student2: string; teacher: string; cash: string; bank: string; director: string };
  const users: Record<string, string> = {};
  /** Rol → haqiqiy User qatori (authorId/actorId FK) */
  const S = (role: string, branchId: string | null = null, userId = users[role]) => ({ userId, role, branchId });

  beforeAll(async () => {
    db = createTestDb("rbac");
    const p = db.prisma;
    const branch = await p.branch.create({ data: { name: "Markaz" } });
    const branch2 = await p.branch.create({ data: { name: "Filial-2" } });
    const d = await p.user.create({ data: { fullName: "Direktor", email: "d@t.local", passwordHash: "x", role: "DIRECTOR" } });
    const teacher = await p.user.create({ data: { fullName: "Akmal", email: "a@t.local", passwordHash: "x", role: "TEACHER", branchId: branch.id } });
    users.DIRECTOR = d.id;
    users.TEACHER = teacher.id;
    for (const role of ["DEPUTY_DIRECTOR", "ACCOUNTANT", "MANAGER", "ADMIN", "OPERATOR", "ROP", "STUDENT", "PARENT"]) {
      users[role] = (await p.user.create({ data: { fullName: role, email: `${role.toLowerCase()}@t.local`, passwordHash: "x", role, branchId: role === "MANAGER" ? branch.id : null } })).id;
    }
    const prog = await p.program.create({ data: { name: "P", monthlyFee: 500_000 } });
    const g = await p.group.create({ data: { name: "G", programId: prog.id, branchId: branch.id, teacherId: teacher.id } });
    const student = await p.student.create({ data: { fullName: "Ali", branchId: branch.id, eduStatus: "ACTIVE", createdAt: T("2026-10-01T05:00:00Z") } });
    const student2 = await p.student.create({ data: { fullName: "Vali", branchId: branch2.id, eduStatus: "ACTIVE", createdAt: T("2026-10-01T05:00:00Z") } });
    await p.groupStudent.create({ data: { groupId: g.id, studentId: student.id, joinedAt: T("2026-10-01T05:00:00Z") } });
    const accounts = await ensureDefaultAccounts(p, branch.id, d.id);
    ids = { branch: branch.id, branch2: branch2.id, student: student.id, student2: student2.id, teacher: teacher.id, director: d.id, cash: accounts.find((a) => a.type === "MAIN_CASH")!.id, bank: accounts.find((a) => a.type === "BANK")!.id };
  });

  afterAll(async () => {
    await db.dispose();
  });

  const forbidden = async (fn: () => Promise<unknown>) => {
    let err: unknown;
    try { await fn(); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(FinanceError);
    expect((err as FinanceError).code).toBe("forbidden");
  };

  it("to'lov: OPERATOR/ROP/TEACHER/STUDENT rad; MANAGER boshqa filial o'quvchisi rad; ADMIN/MANAGER o'z filiali ok", async () => {
    const p = db.prisma;
    const pay = (actor: { userId: string; role: string; branchId: string | null }, studentId: string, key: string) =>
      acceptPayment(p, { studentId, amount: 100_000, method: "CASH", receivedAt: T("2026-10-05T05:00:00Z"), purpose: "Kurs", idempotencyKey: key }, actor, T("2026-10-05T05:00:00Z"));
    for (const role of ["OPERATOR", "ROP", "TEACHER", "STUDENT", "PARENT"]) await forbidden(() => pay(S(role), ids.student, `rbac-pay-${role}`));
    await forbidden(() => pay(S("MANAGER", ids.branch), ids.student2, "rbac-pay-mgr-other"));
    await forbidden(() => pay(S("MANAGER", null), ids.student, "rbac-pay-mgr-nobranch"));
    expect((await pay(S("ADMIN"), ids.student, "rbac-pay-admin-ok")).payment.amount).toBe(100_000);
    expect((await pay(S("MANAGER", ids.branch), ids.student, "rbac-pay-mgr-ok")).payment.amount).toBe(100_000);
    expect(await p.payment.count()).toBe(2);
  });

  it("qaytarim/correction: PAYMENT_CANCEL/CORRECT — MANAGER, ADMIN, OPERATOR rad; ACCOUNTANT ok", async () => {
    const p = db.prisma;
    const payment = await p.payment.findFirstOrThrow({ where: { idempotencyKey: "rbac-pay-admin-ok" } });
    for (const role of ["MANAGER", "ADMIN", "OPERATOR", "TEACHER"]) {
      await forbidden(() => createRefund(p, { paymentId: payment.id, amount: 10_000, reason: "Sabab yetarli", refundedAt: T("2026-10-06T05:00:00Z"), idempotencyKey: `rbac-ref-${role}` }, S(role, ids.branch), T("2026-10-06T05:00:00Z")));
      await forbidden(() => reversePayment(p, { paymentId: payment.id, reason: "Sabab yetarli", idempotencyKey: `rbac-rev-${role}` }, S(role, ids.branch), T("2026-10-06T05:00:00Z")));
    }
    expect(await p.refund.count()).toBe(0);
    const r = await createRefund(p, { paymentId: payment.id, amount: 10_000, reason: "Sabab yetarli", refundedAt: T("2026-10-06T05:00:00Z"), idempotencyKey: "rbac-ref-acc" }, S("ACCOUNTANT"), T("2026-10-06T05:00:00Z"));
    expect(r.refund.amount).toBe(10_000);
  });

  it("IDOR: MANAGER boshqa filial to'lovini qaytara olmaydi / boshqa filial kassasidan xarajat qila olmaydi; ID qo'lda berilsa ham server rad etadi", async () => {
    const p = db.prisma;
    // Boshqa filial (branch2) o'quvchisiga DIRECTOR to'lov qiladi; MANAGER (branch) uni ID bilan qaytarishga urinadi
    const other = await acceptPayment(p, { studentId: ids.student2, amount: 50_000, method: "CASH", receivedAt: T("2026-10-08T05:00:00Z"), purpose: "Kurs", idempotencyKey: "rbac-idor-pay-0001" }, S("DIRECTOR", null, ids.director), T("2026-10-08T05:00:00Z"));
    // MANAGER'da PAYMENT_CANCEL yo'q (forbidden) — ACCOUNTANT'ga filial cheklovi yo'q, lekin MANAGER uchun filial ham tekshiriladi:
    await forbidden(() => createRefund(p, { paymentId: other.payment.id, amount: 10_000, reason: "IDOR urinish", refundedAt: T("2026-10-09T05:00:00Z"), idempotencyKey: "rbac-idor-ref-0001" }, S("MANAGER", ids.branch), T("2026-10-09T05:00:00Z")));
    const otherAcc = await p.financialAccount.findFirstOrThrow({ where: { branchId: ids.branch2, type: "MAIN_CASH" } });
    await forbidden(() => createExpense(p, { name: "IDOR", amount: 1_000, date: T("2026-10-09T05:00:00Z"), method: "CASH", financialAccountId: otherAcc.id, idempotencyKey: "rbac-idor-exp-0001" }, S("MANAGER", ids.branch), T("2026-10-09T06:00:00Z")));
    await forbidden(() => createTransfer(p, { fromAccountId: otherAcc.id, toAccountId: ids.cash, amount: 1_000, occurredAt: T("2026-10-09T05:00:00Z"), idempotencyKey: "rbac-idor-tr-0001" }, S("MANAGER", ids.branch), T("2026-10-09T05:00:00Z")));
    // Boshqa filial o'quvchisiga to'lov (ID qo'lda) — MANAGER rad
    await forbidden(() => acceptPayment(p, { studentId: ids.student2, amount: 1_000, method: "CASH", receivedAt: T("2026-10-09T05:00:00Z"), purpose: "IDOR", idempotencyKey: "rbac-idor-pay-0002" }, S("MANAGER", ids.branch), T("2026-10-09T05:00:00Z")));
    expect(await p.payment.count({ where: { idempotencyKey: { in: ["rbac-idor-pay-0002"] } } })).toBe(0);
    expect(await p.refund.count({ where: { idempotencyKey: "rbac-idor-ref-0001" } })).toBe(0);
  });

  it("xarajat: ADMIN/OPERATOR/TEACHER yaratolmaydi; MANAGER yaratadi, lekin tuzata olmaydi; ACCOUNTANT tuzatadi", async () => {
    const p = db.prisma;
    for (const role of ["ADMIN", "OPERATOR", "TEACHER", "ROP"]) {
      await forbidden(() => createExpense(p, { name: "X", amount: 1000, date: T("2026-10-03T05:00:00Z"), method: "CASH", branchId: ids.branch, idempotencyKey: `rbac-exp-${role}` }, S(role, ids.branch), T("2026-10-03T06:00:00Z")));
    }
    const e = await createExpense(p, { name: "Ijara", amount: 1000, date: T("2026-10-03T05:00:00Z"), method: "CASH", idempotencyKey: "rbac-exp-mgr" }, S("MANAGER", ids.branch), T("2026-10-03T06:00:00Z"));
    await forbidden(() => reverseExpense(p, { expenseId: e.expense.id, reason: "Sabab yetarli", idempotencyKey: "rbac-exp-rev-mgr" }, S("MANAGER", ids.branch), T("2026-10-04T05:00:00Z")));
    const rev = await reverseExpense(p, { expenseId: e.expense.id, reason: "Sabab yetarli", idempotencyKey: "rbac-exp-rev-acc" }, S("ACCOUNTANT"), T("2026-10-04T05:00:00Z"));
    expect(rev.original.status).toBe("REVERSED");
  });

  it("transfer: FINANCIAL_TRANSFER — MANAGER/ADMIN rad; ACCOUNTANT ok", async () => {
    const p = db.prisma;
    const tr = (actor: { userId: string; role: string; branchId: string | null }, key: string) =>
      createTransfer(p, { fromAccountId: ids.cash, toAccountId: ids.bank, amount: 1000, occurredAt: T("2026-10-07T05:00:00Z"), idempotencyKey: key }, actor, T("2026-10-07T05:00:00Z"));
    for (const role of ["MANAGER", "ADMIN", "OPERATOR"]) await forbidden(() => tr(S(role, ids.branch), `rbac-tr-${role}`));
    expect((await tr(S("ACCOUNTANT"), "rbac-tr-acc")).transfer.amount).toBe(1000);
  });

  it("maosh davri: approve faqat DIRECTOR/DEPUTY; payout ACCOUNTANT ok, MANAGER rad; reopen faqat DIRECTOR", async () => {
    const p = db.prisma;
    await createManualEarning(p, { teacherId: ids.teacher, type: "BONUS", amount: 40_000, earningMonth: { year: 2026, month: 10 }, note: "Bonus", actorId: ids.director, idempotencyKey: "rbac-bonus-oct" });
    // Qoidasiz guruh to'lovlari → NEEDS_REVIEW (NO_RULE); tasdiqdan oldin rad etiladi (bu test RBAC uchun)
    for (const e of await p.teacherEarning.findMany({ where: { teacherId: ids.teacher, status: "NEEDS_REVIEW" } })) await rejectReviewedEarning(p, e.id, { userId: ids.director }, "Qoida yo'q — test");
    const period = await recalculateSalaryPeriod(p, ids.teacher, { year: 2026, month: 10 }, { userId: ids.director });
    expect(period).toMatchObject({ status: "CALCULATED", grossAmount: 40_000, remainingAmount: 40_000 });
    for (const role of ["ACCOUNTANT", "MANAGER", "TEACHER", "ADMIN"]) await forbidden(() => approveSalaryPeriod(p, period.id, S(role, ids.branch)));
    const approved = await approveSalaryPeriod(p, period.id, S("DEPUTY_DIRECTOR"));
    expect(approved.status).toBe("APPROVED");
    const payout = (actor: { userId: string; role: string; branchId: string | null }, key: string) =>
      createPayout(p, { salaryPeriodId: period.id, amount: 40_000, financialAccountId: ids.cash, paidAt: T("2026-11-01T05:00:00Z"), idempotencyKey: key }, actor, T("2026-11-01T05:00:00Z"));
    for (const role of ["MANAGER", "TEACHER", "ADMIN", "OPERATOR"]) await forbidden(() => payout(S(role, ids.branch), `rbac-po-${role}`));
    expect((await payout(S("ACCOUNTANT"), "rbac-po-acc")).period.status).toBe("PAID");
    await forbidden(() => closeSalaryPeriod(p, period.id, S("MANAGER", ids.branch), "Yopish sababi"));
    const closed = await closeSalaryPeriod(p, period.id, S("ACCOUNTANT"), "Yopish sababi");
    expect(closed.status).toBe("CLOSED");
    for (const role of ["DEPUTY_DIRECTOR", "ACCOUNTANT", "MANAGER"]) await forbidden(() => reopenSalaryPeriod(p, period.id, S(role), "Qayta ochish sababi"));
    expect((await reopenSalaryPeriod(p, period.id, S("DIRECTOR", null, ids.director), "Qayta ochish sababi")).status).toBe("CALCULATED");
  });
});
