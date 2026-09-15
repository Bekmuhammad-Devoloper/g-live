import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAccount, ensureDefaultAccounts, updateAccount } from "@/lib/finance/accounts/accounts";
import { createTransfer, reverseTransfer } from "@/lib/finance/accounts/transfers";
import { FINANCE_AUDIT_ENTITIES } from "@/lib/finance/audit";
import { adjustCharge, cancelCharge, createManualDebtCharge, ensureMonthlyCharges, replaceCharge } from "@/lib/finance/billing/charges";
import { createDiscount, endDiscount } from "@/lib/finance/billing/discounts";
import { createBillingPolicyVersion } from "@/lib/finance/billing/policy";
import { createExpense, reverseExpense } from "@/lib/finance/expenses/expenses";
import { acceptPayment } from "@/lib/finance/payments/accept";
import { closePeriod, reopenPeriod } from "@/lib/finance/payments/periodLock";
import { monthStart } from "@/lib/finance/period";
import { createRefund, reversePayment } from "@/lib/finance/refunds/refund";
import { assignTeacher, endAssignment } from "@/lib/finance/salary/assignments";
import { createManualEarning, postReviewedEarning } from "@/lib/finance/salary/earnings";
import { approveSalaryPeriod, closeSalaryPeriod, createPayout, recalculateSalaryPeriod, reopenSalaryPeriod } from "@/lib/finance/salary/periods";
import { createSalaryPolicyVersion } from "@/lib/finance/salary/policy";
import { createSalaryRule, endSalaryRule } from "@/lib/finance/salary/rules";
import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// Phase 13 — audit to'liqligi: har moliyaviy amal (to'lov, taqsimot, qaytarim, charge tuzatish,
// chegirma, billing/salary policy, salary rule, tayinlash, earning (accrue/post/manual), davr
// (calculate/approve/close/reopen), payout, xarajat, kassa, transfer, davr qulfi) AuditLog qatori
// qoldiradi — actorId, entityType, action, JSON newValue bilan, moliyaviy yozuv bilan bir tranzaksiyada.

const T = (iso: string) => new Date(iso);
const AUG = { year: 2026, month: 8 };
const OCT = { year: 2026, month: 10 };
const NOV = { year: 2026, month: 11 };

/** Kutilgan (entityType, action) juftliklari — barchasi stsenariy davomida yozilishi shart */
const EXPECTED: [string, string][] = [
  ["Payment", "CREATE"], ["PaymentAllocation", "ALLOCATE"], ["TeacherEarning", "ACCRUE"],
  ["Refund", "REFUND"], ["Payment", "REVERSE"],
  ["StudentCharge", "CREATE"], ["StudentCharge", "CANCEL"], ["StudentCharge", "REPLACE"], ["StudentCharge", "ADJUST"],
  ["StudentDiscount", "CREATE"], ["StudentDiscount", "UPDATE"],
  ["BillingPolicy", "CREATE"], ["SalaryPolicy", "CREATE"],
  ["SalaryRule", "CREATE"], ["SalaryRule", "END"],
  ["GroupTeacherAssignment", "CREATE"], ["GroupTeacherAssignment", "END"],
  ["TeacherEarning", "CREATE"], ["TeacherEarning", "POST"],
  ["SalaryPeriod", "CALCULATE"], ["SalaryPeriod", "APPROVE"], ["SalaryPayout", "PAYOUT"], ["SalaryPeriod", "CLOSE"], ["SalaryPeriod", "REOPEN"],
  ["Expense", "CREATE"], ["Expense", "REVERSE"],
  ["FinancialAccount", "CREATE"], ["FinancialAccount", "UPDATE"], ["Transfer", "TRANSFER"], ["Transfer", "REVERSE"],
  ["FinancePeriodLock", "CLOSE"], ["FinancePeriodLock", "REOPEN"],
];

describe("audit coverage (Phase 13)", () => {
  let db: TestDb;
  let ids: { branch: string; group: string; teacher: string; assistant: string; student: string; director: string; cash: string; bank: string; category: string };
  let director: { userId: string; role: string; branchId: null };

  beforeAll(async () => {
    db = createTestDb("audit");
    const p = db.prisma;
    const branch = await p.branch.create({ data: { name: "Markaz" } });
    const d = await p.user.create({ data: { fullName: "Direktor", email: "d@t.local", passwordHash: "x", role: "DIRECTOR" } });
    const teacher = await p.user.create({ data: { fullName: "Akmal", email: "a@t.local", passwordHash: "x", role: "TEACHER", branchId: branch.id } });
    const assistant = await p.user.create({ data: { fullName: "Yordamchi", email: "y@t.local", passwordHash: "x", role: "TEACHER", branchId: branch.id } });
    const program = await p.program.create({ data: { name: "IELTS", monthlyFee: 1_000_000 } });
    const group = await p.group.create({ data: { name: "IELTS-1", programId: program.id, branchId: branch.id, teacherId: teacher.id, createdAt: T("2026-08-01T05:00:00Z") } });
    const student = await p.student.create({ data: { fullName: "Ali", branchId: branch.id, eduStatus: "ACTIVE", createdAt: T("2026-10-01T05:00:00Z") } });
    await p.groupStudent.create({ data: { groupId: group.id, studentId: student.id, joinedAt: T("2026-10-01T05:00:00Z") } });
    const cat = await p.expenseCategory.create({ data: { name: "Ijara" } });
    const accounts = await ensureDefaultAccounts(p, branch.id, d.id);
    ids = { branch: branch.id, group: group.id, teacher: teacher.id, assistant: assistant.id, student: student.id, director: d.id, category: cat.id, cash: accounts.find((a) => a.type === "MAIN_CASH")!.id, bank: accounts.find((a) => a.type === "BANK")!.id };
    director = { userId: d.id, role: "DIRECTOR", branchId: null };
  });

  afterAll(async () => {
    await db.dispose();
  });

  it("to'liq stsenariy: har amal uchun AuditLog qatori (entityType/action/actorId/JSON), hech biri o'tkazib yuborilmagan", async () => {
    const p = db.prisma;
    const A = ids.director;

    // Siyosat / qoida / tayinlash
    await createBillingPolicyVersion(p, { name: "Standart", effectiveFrom: monthStart(AUG), actorId: A });
    await createSalaryPolicyVersion(p, { name: "Standart", effectiveFrom: monthStart(AUG), actorId: A });
    const global = await createSalaryRule(p, { scope: "GLOBAL", component: "PERCENT", rateBp: 4000, effectiveFrom: monthStart(AUG), actorId: A });
    const main = await assignTeacher(p, { groupId: ids.group, teacherId: ids.teacher, role: "MAIN", effectiveFrom: monthStart(AUG), actorId: A });
    const asst = await assignTeacher(p, { groupId: ids.group, teacherId: ids.assistant, role: "ASSISTANT", effectiveFrom: monthStart(OCT), actorId: A }); // qoida yo'q → NEEDS_REVIEW

    // Chegirma
    const disc = await createDiscount(p, { studentId: ids.student, type: "PERCENT", value: 1000, effectiveFrom: monthStart(OCT), reason: "Imtiyoz", actorId: A });

    // To'lov → taqsimot → earning (ACCRUE: MAIN POSTED + ASSISTANT NEEDS_REVIEW)
    const pay = await acceptPayment(p, { studentId: ids.student, amount: 900_000, method: "CASH", receivedAt: T("2026-10-05T05:00:00Z"), purpose: "Kurs", idempotencyKey: "audit-pay-0001" }, director, T("2026-10-05T05:00:00Z"));
    expect(pay.allocations.length).toBe(1);
    const review = await p.teacherEarning.findFirstOrThrow({ where: { teacherId: ids.assistant, status: "NEEDS_REVIEW" } });
    await postReviewedEarning(p, review.id, { userId: A }, "Yordamchi uchun tekshirildi");
    await createManualEarning(p, { teacherId: ids.teacher, type: "BONUS", amount: 100_000, earningMonth: OCT, note: "Bonus", actorId: A, idempotencyKey: "audit-bonus-oct" });

    // Qaytarim + correction (ikkinchi to'lov reverse qilinadi)
    await createRefund(p, { paymentId: pay.payment.id, amount: 90_000, reason: "Qisman qaytarim", refundedAt: T("2026-10-06T05:00:00Z"), idempotencyKey: "audit-ref-0001" }, director, T("2026-10-06T05:00:00Z"));
    const pay2 = await acceptPayment(p, { studentId: ids.student, amount: 50_000, method: "CASH", receivedAt: T("2026-10-07T05:00:00Z"), purpose: "Kurs", idempotencyKey: "audit-pay-0002" }, director, T("2026-10-07T05:00:00Z"));
    await reversePayment(p, { paymentId: pay2.payment.id, reason: "Xato o'quvchi", idempotencyKey: "audit-rev-0002" }, director, T("2026-10-07T06:00:00Z"));

    // Charge tuzatishlari (noyabr charge — taqsimotsiz)
    await ensureMonthlyCharges(p, { studentId: ids.student, upTo: NOV, actorId: A, now: T("2026-11-02T05:00:00Z") });
    const nov = await p.studentCharge.findFirstOrThrow({ where: { studentId: ids.student, serviceYear: 2026, serviceMonth: 11 } });
    const repl = await replaceCharge(p, { chargeId: nov.id, originalAmount: 1_000_000, discountAmount: 200_000, reason: "Kelishilgan chegirma", actorId: A });
    await adjustCharge(p, { chargeId: repl.id, amount: 30_000, reason: "Qo'shimcha dars", actorId: A });
    const manual = await createManualDebtCharge(p, { studentId: ids.student, amount: 20_000, serviceMonth: NOV, note: "Kitob", actorId: A });
    await cancelCharge(p, manual.id, "Xato kiritilgan", A);
    await endDiscount(p, disc.id, monthStart(NOV), A, "Tugadi");
    await endSalaryRule(p, global.id, T("2026-12-31T19:00:00Z"), A, "Yangi qoida");
    await endAssignment(p, asst.id, T("2026-11-30T19:00:00Z"), A, "Ketdi");
    expect(main.role).toBe("MAIN");

    // Maosh davri: calculate → approve → payout → close → reopen
    const period = await recalculateSalaryPeriod(p, ids.teacher, OCT, { userId: A });
    const approved = await approveSalaryPeriod(p, period.id, director);
    await createPayout(p, { salaryPeriodId: approved.id, amount: approved.remainingAmount, financialAccountId: ids.cash, paidAt: T("2026-11-01T05:00:00Z"), idempotencyKey: "audit-payout-0001" }, director, T("2026-11-01T05:00:00Z"));
    await closeSalaryPeriod(p, period.id, director, "Oy yopildi");
    await reopenSalaryPeriod(p, period.id, director, "Tuzatish kerak");

    // Xarajat + correction; kassa; transfer + teskari; davr qulfi
    const exp = await createExpense(p, { name: "Ijara", amount: 100_000, date: T("2026-10-03T05:00:00Z"), method: "CASH", categoryId: ids.category, branchId: ids.branch, idempotencyKey: "audit-exp-0001" }, director, T("2026-10-03T06:00:00Z"));
    await reverseExpense(p, { expenseId: exp.expense.id, reason: "Summa xato edi", idempotencyKey: "audit-exp-rev-0001" }, director, T("2026-10-04T05:00:00Z"));
    const safe = await createAccount(p, { branchId: ids.branch, name: "Seyf", type: "CUSTOM", openingBalance: 1_000, openingAt: T("2026-09-30T19:00:00Z"), actorId: A });
    await updateAccount(p, { id: safe.id, name: "Seyf (asosiy)", actorId: A });
    const tr = await createTransfer(p, { fromAccountId: ids.cash, toAccountId: ids.bank, amount: 10_000, occurredAt: T("2026-10-08T05:00:00Z"), idempotencyKey: "audit-tr-0001" }, director, T("2026-10-08T05:00:00Z"));
    await reverseTransfer(p, { transferId: tr.transfer.id, reason: "Xato o'tkazma", idempotencyKey: "audit-tr-rev-0001" }, director, T("2026-10-09T05:00:00Z"));
    await closePeriod(p, { branchId: null, ym: AUG, reason: "Avgust yopiq", actorId: A });
    await reopenPeriod(p, { branchId: null, ym: AUG, reason: "Tuzatish", actorId: A });

    // Tekshiruv: kutilgan juftliklar mavjud
    const rows = await p.auditLog.findMany({ orderBy: { createdAt: "asc" } });
    const have = new Set(rows.map((r) => `${r.entityType}:${r.action}`));
    const missing = EXPECTED.filter(([e, a]) => !have.has(`${e}:${a}`));
    expect(missing).toEqual([]);

    // Har qator: moliya entity turi, actorId to'ldirilgan, newValue JSON (bo'lsa) parse bo'ladi
    const financeEntities = new Set<string>(Object.values(FINANCE_AUDIT_ENTITIES));
    for (const r of rows) {
      expect(financeEntities.has(r.entityType)).toBe(true);
      expect(r.actorId).toBe(A);
      if (r.newValue) expect(() => JSON.parse(r.newValue!)).not.toThrow();
      if (r.oldValue) expect(() => JSON.parse(r.oldValue!)).not.toThrow();
    }

    // Taqsimot auditi to'lovga bog'langan, allocation id/charge/amount bilan
    const alloc = rows.find((r) => r.entityType === "PaymentAllocation" && r.entityId === pay.payment.id);
    expect(JSON.parse(alloc!.newValue!).allocations).toEqual([{ id: pay.allocations[0].id, chargeId: pay.allocations[0].chargeId, amount: pay.allocations[0].amount, source: "AUTO_FIFO" }]);
    // Earning accrual auditi: MAIN POSTED + ASSISTANT NEEDS_REVIEW (ASSISTANT_NO_RULE)
    const accrue = rows.find((r) => r.entityType === "TeacherEarning" && r.action === "ACCRUE" && r.entityId === pay.payment.id);
    const created = JSON.parse(accrue!.newValue!).created as { teacherId: string; status: string; reviewReason: string | null }[];
    expect(created.map((c) => [c.teacherId === ids.teacher ? "main" : "asst", c.status, c.reviewReason]).sort()).toEqual([["asst", "NEEDS_REVIEW", "ASSISTANT_NO_RULE"], ["main", "POSTED", null]]);
    // Qaytarim auditi: reversal + REFUND_ADJUSTMENT ro'yxati; sabab saqlangan
    const ref = rows.find((r) => r.entityType === "Refund");
    const refVal = JSON.parse(ref!.newValue!);
    expect(refVal.reversals.length).toBe(1);
    expect(refVal.adjustments.length).toBeGreaterThanOrEqual(1);
    expect(ref!.reason).toBe("Qisman qaytarim");
  });

  it("audit tranzaksiya ichida: dvigatel xatosi → moliyaviy yozuv ham, audit ham yozilmaydi", async () => {
    const p = db.prisma;
    const before = await p.auditLog.count();
    // Davr qulfi (dekabr) → to'lov rad; audit qatori qolmasligi kerak
    await closePeriod(p, { branchId: null, ym: { year: 2026, month: 12 }, reason: "Dekabr yopiq", actorId: ids.director });
    await expect(acceptPayment(p, { studentId: ids.student, amount: 1_000, method: "CASH", receivedAt: T("2026-12-03T05:00:00Z"), purpose: "Kurs", idempotencyKey: "audit-pay-locked" }, director, T("2026-12-03T05:00:00Z"))).rejects.toThrow(/yopiq/);
    expect(await p.payment.count({ where: { idempotencyKey: "audit-pay-locked" } })).toBe(0);
    expect(await p.auditLog.count()).toBe(before + 1); // faqat FinancePeriodLock CLOSE
  });
});
