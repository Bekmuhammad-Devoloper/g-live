import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";

import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// Phase 1 — Finance V2 sxemasi vaqtinchalik SQLite bazada:
//   • yangi jadvallar yaratiladi va yoziladi
//   • unique/idempotency cheklovlar bazada ishlaydi (SQLite NULL-unique tuzog'i ham)
//   • Restrict: moliyaviy tarixi bor o'quvchi/guruh/kassa o'chirilmaydi
//   • eski Payment.create (yangi maydonlarsiz) buzilmagan — legacy kod ishlashda davom etadi

const P2002 = "P2002"; // unique
const P2003 = "P2003"; // foreign key (Restrict)

async function expectPrismaError(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      expect(e.code).toBe(code);
      return;
    }
    throw e;
  }
  throw new Error(`kutilgan xato ${code} chiqmadi`);
}

describe("finance v2 schema", () => {
  let db: TestDb;
  let ids: { branch: string; teacher: string; student: string; program: string; group: string; account: string; payment: string };

  beforeAll(async () => {
    db = createTestDb("schema");
    const p = db.prisma;
    const branch = await p.branch.create({ data: { name: "Markaz" } });
    const teacher = await p.user.create({ data: { fullName: "Akmal", email: "akmal@test.local", passwordHash: "x", role: "TEACHER" } });
    const student = await p.student.create({ data: { fullName: "Ali Karimov", branchId: branch.id } });
    const program = await p.program.create({ data: { name: "IELTS", monthlyFee: 1_000_000 } });
    const group = await p.group.create({ data: { name: "IELTS-12", programId: program.id, teacherId: teacher.id, branchId: branch.id } });
    const account = await p.financialAccount.create({ data: { name: "Asosiy kassa", type: "MAIN_CASH", branchId: branch.id } });
    // Legacy uslub: yangi maydonlarsiz — eski kod shu ko'rinishda yozadi
    const payment = await p.payment.create({ data: { studentId: student.id, amount: 1_000_000, method: "CASH", status: "PAID" } });
    ids = { branch: branch.id, teacher: teacher.id, student: student.id, program: program.id, group: group.id, account: account.id, payment: payment.id };
  });

  afterAll(async () => {
    await db.dispose();
  });

  it("legacy Payment yangi maydonlarsiz yoziladi; V2 maydonlar null/default", async () => {
    const row = await db.prisma.payment.findUniqueOrThrow({ where: { id: ids.payment } });
    expect(row.receivedAt).toBeNull();
    expect(row.legacyRole).toBeNull();
    expect(row.idempotencyKey).toBeNull();
    // SQLite: unique ustunda bir nechta NULL ruxsat — ikkinchi legacy to'lov ham yoziladi
    await db.prisma.payment.create({ data: { studentId: ids.student, amount: 5_000, method: "CASH", status: "PAID" } });
  });

  it("ledger: idempotencyKey va (reference, account, direction, sequence) unique; split sequence bilan ruxsat", async () => {
    const p = db.prisma;
    const base = { accountId: ids.account, branchId: ids.branch, type: "STUDENT_PAYMENT", direction: "IN", amount: 1_000_000, referenceType: "Payment", referenceId: ids.payment, occurredAt: new Date() };
    await p.financialTransaction.create({ data: { ...base, sequence: 0, idempotencyKey: "pay:1:in:0" } });
    await expectPrismaError(p.financialTransaction.create({ data: { ...base, sequence: 0, idempotencyKey: "pay:1:in:0-dup" } }), P2002);
    await expectPrismaError(p.financialTransaction.create({ data: { ...base, sequence: 1, idempotencyKey: "pay:1:in:0" } }), P2002);
    await p.financialTransaction.create({ data: { ...base, amount: 1, sequence: 1, idempotencyKey: "pay:1:in:1" } });
    expect(await p.financialTransaction.count({ where: { referenceId: ids.payment } })).toBe(2);
  });

  it("charge: chargeKey unique; allocation immutable tarix (ALLOCATION + REVERSAL)", async () => {
    const p = db.prisma;
    const charge = await p.studentCharge.create({
      data: {
        studentId: ids.student, branchId: ids.branch, groupId: ids.group, programId: ids.program,
        kind: "MONTHLY", serviceYear: 2026, serviceMonth: 9, originalAmount: 1_000_000, finalAmount: 1_000_000,
        dueDate: new Date("2026-08-31T19:00:00Z"), chargeKey: `${ids.student}:${ids.group}:2026-09`,
      },
    });
    await expectPrismaError(
      p.studentCharge.create({ data: { studentId: ids.student, kind: "MONTHLY", serviceYear: 2026, serviceMonth: 9, originalAmount: 1, finalAmount: 1, dueDate: new Date(), chargeKey: `${ids.student}:${ids.group}:2026-09` } }),
      P2002,
    );

    const alloc = await p.paymentAllocation.create({
      data: { paymentId: ids.payment, chargeId: charge.id, amount: 1_000_000, kind: "ALLOCATION", source: "AUTO_FIFO", idempotencyKey: `alloc:${ids.payment}:${charge.id}:0` },
    });
    await expectPrismaError(
      p.paymentAllocation.create({ data: { paymentId: ids.payment, chargeId: charge.id, amount: 1, kind: "ALLOCATION", source: "AUTO_FIFO", idempotencyKey: alloc.idempotencyKey } }),
      P2002,
    );
    const refund = await p.refund.create({
      data: { originalPaymentId: ids.payment, studentId: ids.student, amount: 300_000, reason: "test", financialAccountId: ids.account, refundedAt: new Date(), idempotencyKey: "refund:1" },
    });
    const reversal = await p.paymentAllocation.create({
      data: { paymentId: ids.payment, chargeId: charge.id, amount: 300_000, kind: "REVERSAL", reversalOfId: alloc.id, refundId: refund.id, source: "MANUAL", idempotencyKey: `rev:${alloc.id}:${refund.id}` },
    });
    const history = await p.paymentAllocation.findMany({ where: { chargeId: charge.id }, orderBy: { createdAt: "asc" } });
    expect(history.map((h) => h.kind)).toEqual(["ALLOCATION", "REVERSAL"]);
    expect(reversal.reversalOfId).toBe(alloc.id);
    // remaining = final − Σ ALLOCATION + Σ REVERSAL
    const remaining = 1_000_000 - 1_000_000 + 300_000;
    expect(remaining).toBe(300_000);
  });

  it("assignment tarixi + earning: idempotencyKey unique; earning oyi receivedAt oyidan (sentabr), xizmat oktabr", async () => {
    const p = db.prisma;
    const policy = await p.salaryPolicy.create({ data: { name: "Standart", effectiveFrom: new Date("2026-09-30T19:00:00Z") } });
    const rule = await p.salaryRule.create({ data: { scope: "GLOBAL", amountType: "PERCENT", amount: 40, rateBp: 4000, policyId: policy.id, effectiveFrom: new Date("2026-09-30T19:00:00Z") } });
    const asg = await p.groupTeacherAssignment.create({ data: { groupId: ids.group, teacherId: ids.teacher, role: "MAIN", effectiveFrom: new Date("2026-08-31T19:00:00Z") } });
    const alloc = await p.paymentAllocation.findFirstOrThrow({ where: { kind: "ALLOCATION" } });
    const earning = await p.teacherEarning.create({
      data: {
        teacherId: ids.teacher, studentId: ids.student, sourcePaymentId: ids.payment, allocationId: alloc.id, chargeId: alloc.chargeId,
        groupId: ids.group, programId: ids.program, branchId: ids.branch, policyId: policy.id, ruleId: rule.id, assignmentId: asg.id,
        serviceYear: 2026, serviceMonth: 10, receivedAt: new Date("2026-09-20T05:00:00Z"), earningYear: 2026, earningMonth: 9,
        baseAmount: 1_000_000, eligibleAmount: 1_000_000, rateBp: 4000, amount: 400_000, type: "PAYMENT_COMMISSION",
        snapshot: "{}", idempotencyKey: `alloc:${alloc.id}:asg:${asg.id}`,
      },
    });
    expect(earning.earningMonth).toBe(9);
    expect(earning.serviceMonth).toBe(10);
    await expectPrismaError(
      p.teacherEarning.create({ data: { teacherId: ids.teacher, earningYear: 2026, earningMonth: 9, amount: 1, type: "PAYMENT_COMMISSION", snapshot: "{}", idempotencyKey: earning.idempotencyKey } }),
      P2002,
    );
  });

  it("salary period unique (teacher, year, month); payout va lock kalitlari", async () => {
    const p = db.prisma;
    const period = await p.salaryPeriod.create({ data: { teacherId: ids.teacher, year: 2026, month: 9 } });
    await expectPrismaError(p.salaryPeriod.create({ data: { teacherId: ids.teacher, year: 2026, month: 9 } }), P2002);
    await p.salaryPayout.create({ data: { teacherId: ids.teacher, salaryPeriodId: period.id, financialAccountId: ids.account, amount: 5_000_000, paidAt: new Date(), idempotencyKey: "payout:1" } });
    await expectPrismaError(
      p.salaryPayout.create({ data: { teacherId: ids.teacher, salaryPeriodId: period.id, financialAccountId: ids.account, amount: 1, paidAt: new Date(), idempotencyKey: "payout:1" } }),
      P2002,
    );
    // FinancePeriodLock: branchId null ikki marta — lockKey to'xtatadi (SQLite NULL-unique tuzog'i)
    await p.financePeriodLock.create({ data: { year: 2026, month: 9, reason: "yopildi", lockKey: "-:2026-09" } });
    await expectPrismaError(p.financePeriodLock.create({ data: { year: 2026, month: 9, reason: "yana", lockKey: "-:2026-09" } }), P2002);
  });

  it("Restrict: moliyaviy tarixi bor o'quvchi, guruh, kassa o'chirilmaydi", async () => {
    const p = db.prisma;
    await expectPrismaError(p.student.delete({ where: { id: ids.student } }), P2003);
    await expectPrismaError(p.group.delete({ where: { id: ids.group } }), P2003);
    await expectPrismaError(p.financialAccount.delete({ where: { id: ids.account } }), P2003);
    await expectPrismaError(p.payment.delete({ where: { id: ids.payment } }), P2003);
  });

  it("transfer: ikki kassa, self-reversal one-to-one", async () => {
    const p = db.prisma;
    const bank = await p.financialAccount.create({ data: { name: "Bank", type: "BANK", branchId: ids.branch } });
    const t = await p.transfer.create({ data: { fromAccountId: ids.account, toAccountId: bank.id, amount: 5_000_000, occurredAt: new Date(), idempotencyKey: "tr:1" } });
    const r = await p.transfer.create({ data: { fromAccountId: bank.id, toAccountId: ids.account, amount: 5_000_000, occurredAt: new Date(), idempotencyKey: "tr:1:rev", reversalOfId: t.id } });
    await expectPrismaError(
      p.transfer.create({ data: { fromAccountId: bank.id, toAccountId: ids.account, amount: 1, occurredAt: new Date(), idempotencyKey: "tr:1:rev2", reversalOfId: t.id } }),
      P2002,
    );
    const withBack = await p.transfer.findUniqueOrThrow({ where: { id: t.id }, include: { reversedBy: true } });
    expect(withBack.reversedBy?.id).toBe(r.id);
  });
});
