import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { studentBalance } from "@/lib/finance/billing/balance";
import { FinanceError } from "@/lib/finance/errors";
import { acceptPayment } from "@/lib/finance/payments/accept";
import { monthStart } from "@/lib/finance/period";
import { createRefund, reversePayment } from "@/lib/finance/refunds/refund";
import { syncGroupTeacherAssignment } from "@/lib/finance/salary/assignments";
import { ensureSalaryPeriod } from "@/lib/finance/salary/periods";
import { createSalaryRule } from "@/lib/finance/salary/rules";
import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// Phase 7 — CASE F: 1M to'lov, 40% → 400k; 300k refund → −120k adjustment; davr OPEN → shu davr,
// PAID → keyingi ochiq davr; kredit qismidan refund; Σ refund ≤ amount; correction (reverse + new).

const T = (iso: string) => new Date(iso);
const CUTOVER = T("2026-07-31T19:00:00Z");
const AUG = { year: 2026, month: 8 };
const OCT = { year: 2026, month: 10 };

describe("refund / adjustment engine (Phase 7)", () => {
  let db: TestDb;
  let ids: { branch: string; group: string; teacher: string; student: string; director: string };
  let actor: { userId: string; role: string; branchId: null };

  beforeAll(async () => {
    db = createTestDb("refunds");
    const p = db.prisma;
    const branch = await p.branch.create({ data: { name: "Markaz" } });
    const director = await p.user.create({ data: { fullName: "Direktor", email: "d@t.local", passwordHash: "x", role: "DIRECTOR" } });
    const teacher = await p.user.create({ data: { fullName: "Akmal", email: "a@t.local", passwordHash: "x", role: "TEACHER" } });
    const program = await p.program.create({ data: { name: "IELTS", monthlyFee: 1_000_000 } });
    const group = await p.group.create({ data: { name: "IELTS-12", programId: program.id, branchId: branch.id, teacherId: teacher.id, createdAt: T("2026-08-01T05:00:00Z") } });
    const student = await p.student.create({ data: { fullName: "Ali", branchId: branch.id, eduStatus: "ACTIVE", createdAt: T("2026-10-01T05:00:00Z") } });
    await p.groupStudent.create({ data: { groupId: group.id, studentId: student.id, joinedAt: T("2026-10-01T05:00:00Z") } });
    await syncGroupTeacherAssignment(p, group.id, { at: T("2026-08-01T05:00:00Z"), cutoverAt: CUTOVER });
    await createSalaryRule(p, { scope: "GLOBAL", component: "PERCENT", rateBp: 4000, effectiveFrom: monthStart(AUG) });
    ids = { branch: branch.id, group: group.id, teacher: teacher.id, student: student.id, director: director.id };
    actor = { userId: director.id, role: "DIRECTOR", branchId: null };
  });

  afterAll(async () => {
    await db.dispose();
  });

  it("CASE F (davr OPEN): 1M to'lov → 400k; 300k refund → REVERSAL 300k, adjustment −120k shu davrga; ledger OUT; qarz qayta ochiladi", async () => {
    const p = db.prisma;
    const pay = await acceptPayment(p, { studentId: ids.student, amount: 1_000_000, method: "CASH", receivedAt: T("2026-10-10T05:00:00Z"), purpose: "Kurs", idempotencyKey: "ref-pay-0001" }, actor, T("2026-10-10T05:00:00Z"));
    const earning = await p.teacherEarning.findFirstOrThrow({ where: { sourcePaymentId: pay.payment.id } });
    expect(earning.amount).toBe(400_000);

    const r = await createRefund(p, { paymentId: pay.payment.id, amount: 300_000, reason: "Qisman qaytarim", refundedAt: T("2026-10-20T05:00:00Z"), idempotencyKey: "ref-0001" }, actor, T("2026-10-20T05:00:00Z"));
    expect(r.replayed).toBe(false);
    expect(r.reversals).toHaveLength(1);
    expect(r.reversals[0]).toMatchObject({ kind: "REVERSAL", amount: 300_000, reversalOfId: pay.allocations[0].id, refundId: r.refund.id });
    expect(r.adjustments).toHaveLength(1);
    const adj = r.adjustments[0];
    expect(adj).toMatchObject({ type: "REFUND_ADJUSTMENT", amount: -120_000, rateBp: 4000, earningMonth: 10, reversalOfId: earning.id, refundId: r.refund.id, status: "POSTED" });
    expect(adj.settlementPeriodId).toBe(earning.settlementPeriodId); // oktabr OPEN → shu davr
    // asl earning va allocation o'zgarmagan
    expect((await p.teacherEarning.findUniqueOrThrow({ where: { id: earning.id } })).amount).toBe(400_000);
    expect((await p.paymentAllocation.findUniqueOrThrow({ where: { id: pay.allocations[0].id } })).amount).toBe(1_000_000);
    // ledger OUT
    const out = await p.financialTransaction.findFirstOrThrow({ where: { referenceType: "Refund", referenceId: r.refund.id } });
    expect(out).toMatchObject({ direction: "OUT", amount: 300_000, type: "REFUND" });
    // qarz 300k qayta ochildi, kredit 0
    expect(r.balance.debt).toBe(300_000);
    expect(r.balance.credit).toBe(0);
    expect((await p.studentCharge.findFirstOrThrow({ where: { studentId: ids.student, serviceMonth: 10 } })).status).toBe("PARTIALLY_PAID");
    // idempotent
    const again = await createRefund(p, { paymentId: pay.payment.id, amount: 300_000, reason: "Qisman qaytarim", refundedAt: T("2026-10-20T05:00:00Z"), idempotencyKey: "ref-0001" }, actor, T("2026-10-20T05:00:00Z"));
    expect(again.replayed).toBe(true);
    expect(await p.refund.count()).toBe(1);
    expect(await p.teacherEarning.count({ where: { type: "REFUND_ADJUSTMENT" } })).toBe(1);
  });

  it("Σ refund ≤ amount; davr PAID bo'lsa adjustment KEYINGI ochiq davrga, tarixiy earningMonth o'zgarmaydi", async () => {
    const p = db.prisma;
    const pay = await p.payment.findFirstOrThrow({ where: { idempotencyKey: "ref-pay-0001" } });
    await expect(createRefund(p, { paymentId: pay.id, amount: 800_000, reason: "Ko'p", refundedAt: T("2026-11-05T05:00:00Z"), idempotencyKey: "ref-too-much" }, actor, T("2026-11-05T05:00:00Z"))).rejects.toThrow(/oshadi/);
    // Oktabr davri PAID deb belgilanadi
    const oct = await ensureSalaryPeriod(p, ids.teacher, OCT);
    await p.salaryPeriod.update({ where: { id: oct.id }, data: { status: "PAID" } });
    const r = await createRefund(p, { paymentId: pay.id, amount: 200_000, reason: "Yana qaytarim", refundedAt: T("2026-12-05T05:00:00Z"), idempotencyKey: "ref-0002" }, actor, T("2026-12-05T05:00:00Z"));
    const adj = r.adjustments[0];
    expect(adj.amount).toBe(-80_000);
    expect(adj.earningMonth).toBe(10); // tarixiy attribution
    const settlement = await p.salaryPeriod.findUniqueOrThrow({ where: { id: adj.settlementPeriodId! } });
    expect(settlement.month).toBe(11); // keyingi ochiq davr
    expect((await p.salaryPeriod.findUniqueOrThrow({ where: { id: oct.id } })).status).toBe("PAID"); // yopiq davr tegilmagan
    expect(await p.refund.aggregate({ _sum: { amount: true }, where: { originalPaymentId: pay.id } }).then((x) => x._sum.amount)).toBe(500_000);
  });

  it("kredit qismidan qaytarim: reversal yo'q, kredit kamayadi; RBAC/qulf", async () => {
    const p = db.prisma;
    // 2M to'lov: okt qoldiq 500k + noyabr 1M (charge yo'q hali — upTo nov) → aslida noyabr charge yaratiladi (now noyabr) → 500k kredit
    const pay = await acceptPayment(p, { studentId: ids.student, amount: 2_000_000, method: "CASH", receivedAt: T("2026-11-10T05:00:00Z"), purpose: "Avans", idempotencyKey: "ref-pay-0002" }, actor, T("2026-11-10T05:00:00Z"));
    const b0 = await studentBalance(p, ids.student);
    expect(b0.credit).toBe(500_000);
    const r = await createRefund(p, { paymentId: pay.payment.id, amount: 400_000, reason: "Avansdan qaytarim", refundedAt: T("2026-11-12T05:00:00Z"), idempotencyKey: "ref-0003" }, actor, T("2026-11-12T05:00:00Z"));
    expect(r.reversals).toHaveLength(0);
    expect(r.adjustments).toHaveLength(0);
    expect(r.balance.credit).toBe(100_000);
    // kredit + allocation'dan: 300k → 100k kreditdan, 200k eng yangi allocation (noyabr) dan
    const r2 = await createRefund(p, { paymentId: pay.payment.id, amount: 300_000, reason: "Yana", refundedAt: T("2026-11-13T05:00:00Z"), idempotencyKey: "ref-0004" }, actor, T("2026-11-13T05:00:00Z"));
    expect(r2.reversals).toHaveLength(1);
    expect(r2.reversals[0].amount).toBe(200_000);
    expect(r2.balance.credit).toBe(0);
    await expect(createRefund(p, { paymentId: pay.payment.id, amount: 1, reason: "Ruxsatsiz", refundedAt: T("2026-11-13T05:00:00Z"), idempotencyKey: "ref-0005" }, { userId: "m", role: "MANAGER", branchId: ids.branch }, T("2026-11-13T05:00:00Z"))).rejects.toThrow(FinanceError);
  });

  it("correction: reversePayment — to'liq CORRECTION refund, status REVERSED, yangi to'g'ri to'lov reversalOfId bilan", async () => {
    const p = db.prisma;
    const s2 = await p.student.create({ data: { fullName: "Xato", branchId: ids.branch, eduStatus: "ACTIVE", createdAt: T("2026-10-01T05:00:00Z") } });
    await p.groupStudent.create({ data: { groupId: ids.group, studentId: s2.id, joinedAt: T("2026-10-01T05:00:00Z") } });
    const wrong = await acceptPayment(p, { studentId: s2.id, amount: 100_000, method: "CASH", receivedAt: T("2026-10-05T05:00:00Z"), purpose: "Kurs", idempotencyKey: "ref-wrong-0001" }, actor, T("2026-10-05T05:00:00Z"));
    const res = await reversePayment(p, { paymentId: wrong.payment.id, reason: "Summa xato kiritilgan (1M edi)", idempotencyKey: "corr-0001", replacement: { amount: 1_000_000, method: "CASH", receivedAt: T("2026-10-05T05:00:00Z"), purpose: "Kurs (tuzatilgan)", idempotencyKey: "x" } }, actor, T("2026-10-06T05:00:00Z"));
    expect(res.reversed.status).toBe("REVERSED");
    expect(res.refund.refund.kind).toBe("CORRECTION");
    expect(res.refund.refund.amount).toBe(100_000);
    expect(res.replacement?.reversalOfId).toBe(wrong.payment.id);
    expect(res.replacement?.amount).toBe(1_000_000);
    // eski to'lov o'chirilmagan; earning: eski +40k, adjustment −40k, yangi +400k
    expect(await p.payment.count({ where: { id: wrong.payment.id } })).toBe(1);
    const earnings = await p.teacherEarning.findMany({ where: { studentId: s2.id }, orderBy: { createdAt: "asc" } });
    expect(earnings.map((e) => [e.type, e.amount])).toEqual([["PAYMENT_COMMISSION", 40_000], ["REFUND_ADJUSTMENT", -40_000], ["PAYMENT_COMMISSION", 400_000]]);
    const bal = await studentBalance(p, s2.id);
    expect(bal.debt).toBe(0);
    expect(bal.credit).toBe(0);
    await expect(reversePayment(p, { paymentId: wrong.payment.id, reason: "yana", idempotencyKey: "corr-0002" }, actor)).rejects.toThrow(/REVERSED/);
  });
});
