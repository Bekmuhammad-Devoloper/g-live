import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ensureMonthlyCharges } from "@/lib/finance/billing/charges";
import { acceptPayment } from "@/lib/finance/payments/accept";
import { applyStudentCredit } from "@/lib/finance/payments/allocate";
import { monthStart } from "@/lib/finance/period";
import { assignTeacher, groupRateSum, syncGroupTeacherAssignment } from "@/lib/finance/salary/assignments";
import { createEarningsForAllocations, createManualEarning, postReviewedEarning } from "@/lib/finance/salary/earnings";
import { ensureSalaryPeriod, settlementPeriodFor } from "@/lib/finance/salary/periods";
import { createSalaryPolicyVersion } from "@/lib/finance/salary/policy";
import { createSalaryRule } from "@/lib/finance/salary/rules";
import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// Phase 6 — TeacherEarning: CASE A–E (reja §9), avans (S7), o'qituvchi almashishi (D1/RULE 6),
// tarixiy qoida (RULE 7), INFERRED → review, Σ>100% → review, idempotent.

const T = (iso: string) => new Date(iso);
const CUTOVER = T("2026-07-31T19:00:00Z"); // 1-avgust — testda tarix KNOWN bo'lishi uchun
const AUG = { year: 2026, month: 8 };
const OCT = { year: 2026, month: 10 };
const NOV = { year: 2026, month: 11 };

describe("teacher earning engine (Phase 6)", () => {
  let db: TestDb;
  let ids: { branch: string; program: string; group: string; groupE: string; teacherA: string; teacherB: string; assistant: string; student: string; studentE: string; director: string };
  let actor: { userId: string; role: string; branchId: null };

  beforeAll(async () => {
    db = createTestDb("earnings");
    const p = db.prisma;
    const branch = await p.branch.create({ data: { name: "Markaz" } });
    const director = await p.user.create({ data: { fullName: "Direktor", email: "d@t.local", passwordHash: "x", role: "DIRECTOR" } });
    const teacherA = await p.user.create({ data: { fullName: "Teacher A", email: "a@t.local", passwordHash: "x", role: "TEACHER" } });
    const teacherB = await p.user.create({ data: { fullName: "Teacher B", email: "b@t.local", passwordHash: "x", role: "TEACHER" } });
    const assistant = await p.user.create({ data: { fullName: "Assistant", email: "as@t.local", passwordHash: "x", role: "TEACHER" } });
    const program = await p.program.create({ data: { name: "IELTS", monthlyFee: 1_000_000 } });
    const group = await p.group.create({ data: { name: "IELTS-12", programId: program.id, branchId: branch.id, teacherId: teacherA.id, createdAt: T("2026-08-01T05:00:00Z") } });
    const groupE = await p.group.create({ data: { name: "IELTS-E", programId: program.id, branchId: branch.id, teacherId: teacherA.id, createdAt: T("2026-08-01T05:00:00Z") } });
    const student = await p.student.create({ data: { fullName: "Ali", branchId: branch.id, eduStatus: "ACTIVE", createdAt: T("2026-09-01T05:00:00Z") } });
    await p.groupStudent.create({ data: { groupId: group.id, studentId: student.id, joinedAt: T("2026-09-01T05:00:00Z") } });
    const studentE = await p.student.create({ data: { fullName: "Vali", branchId: branch.id, eduStatus: "ACTIVE", createdAt: T("2026-10-01T05:00:00Z") } });
    await p.groupStudent.create({ data: { groupId: groupE.id, studentId: studentE.id, joinedAt: T("2026-10-01T05:00:00Z") } });
    // Tayinlash tarixi: KNOWN (cutover 1-avgust, guruh 1-avgustda yaratilgan)
    await syncGroupTeacherAssignment(p, group.id, { at: T("2026-08-01T05:00:00Z"), cutoverAt: CUTOVER });
    await syncGroupTeacherAssignment(p, groupE.id, { at: T("2026-08-01T05:00:00Z"), cutoverAt: CUTOVER });
    // Qoidalar: GLOBAL 40% avgustdan; oktabrdan Teacher A 45% (RULE 7 sinovi)
    await createSalaryRule(p, { scope: "GLOBAL", component: "PERCENT", rateBp: 4000, effectiveFrom: monthStart(AUG) });
    await createSalaryRule(p, { scope: "TEACHER", targetId: teacherA.id, component: "PERCENT", rateBp: 4500, effectiveFrom: monthStart(OCT) });
    await createSalaryPolicyVersion(p, { name: "Standart", effectiveFrom: monthStart(AUG) });
    ids = { branch: branch.id, program: program.id, group: group.id, groupE: groupE.id, teacherA: teacherA.id, teacherB: teacherB.id, assistant: assistant.id, student: student.id, studentE: studentE.id, director: director.id };
    actor = { userId: director.id, role: "DIRECTOR", branchId: null };
  });

  afterAll(async () => {
    await db.dispose();
  });

  const pay = (studentId: string, amount: number, receivedAt: string, key: string) =>
    acceptPayment(db.prisma, { studentId, amount, method: "CASH", receivedAt: T(receivedAt), purpose: "Kurs", idempotencyKey: key }, actor, T(receivedAt));

  it("CASE A + RULE 7: sentabr qarzi 10-oktabrda to'landi → Teacher A, rate SENTABR (40%), earningMonth OKTABR, settlement oktabr", async () => {
    // Sentabr davri hali ochilmagan → charge'lar: sen (upTo receivedAt oyi = okt → sen + okt)
    const r = await pay(ids.student, 1_000_000, "2026-10-10T05:00:00Z", "earn-case-a-0001");
    expect(r.allocations).toHaveLength(1); // FIFO: sentabr 1M
    const earnings = await db.prisma.teacherEarning.findMany({ where: { sourcePaymentId: r.payment.id } });
    expect(earnings).toHaveLength(1);
    const e = earnings[0];
    expect(e.teacherId).toBe(ids.teacherA);
    expect(e.serviceMonth).toBe(9);
    expect(e.rateBp).toBe(4000); // sentabr qoidasi (oktabrdagi 45% emas)
    expect(e.amount).toBe(400_000);
    expect(e.earningYear).toBe(2026);
    expect(e.earningMonth).toBe(10);
    expect(e.status).toBe("POSTED");
    const period = await db.prisma.salaryPeriod.findUniqueOrThrow({ where: { id: e.settlementPeriodId! } });
    expect([period.year, period.month]).toEqual([2026, 10]);
    const snap = JSON.parse(e.snapshot);
    expect(snap.sourcePayment.receivedAt).toBe("2026-10-10T05:00:00.000Z");
    expect(snap.rule.rateBp).toBe(4000);
    expect(snap.assignment.source).toBe("KNOWN");
  });

  it("CASE B + C: 25-okt 1.5M → okt charge 500k (45% oktabr qoidasi) → 225k; keyin 500k → 225k; idempotent qayta ishga tushirish", async () => {
    const r = await pay(ids.student, 1_500_000, "2026-10-25T05:00:00Z", "earn-case-b-0001");
    // sentabr allaqachon to'langan → okt 1M ga 1M, 500k kredit
    const octEarnings = await db.prisma.teacherEarning.findMany({ where: { sourcePaymentId: r.payment.id } });
    expect(octEarnings).toHaveLength(1);
    expect(octEarnings[0].serviceMonth).toBe(10);
    expect(octEarnings[0].rateBp).toBe(4500);
    expect(octEarnings[0].amount).toBe(450_000);
    // Qayta ishga tushirish — dublikat yo'q (unique + idempotencyKey)
    const again = await createEarningsForAllocations(db.prisma, r.allocations);
    expect(again.created).toHaveLength(0);
    expect(again.existing).toBe(1);
    expect(await db.prisma.teacherEarning.count({ where: { sourcePaymentId: r.payment.id } })).toBe(1);
  });

  it("AVANS (S7): oktabrdagi 500k kredit noyabr charge'iga qo'llanadi → earningMonth OKTABR, xizmat NOYABR; oktabr davri APPROVED → settlement noyabr", async () => {
    const octPeriod = await ensureSalaryPeriod(db.prisma, ids.teacherA, OCT);
    await db.prisma.salaryPeriod.update({ where: { id: octPeriod.id }, data: { status: "APPROVED" } });
    await ensureMonthlyCharges(db.prisma, { studentId: ids.student, upTo: NOV, cutoverAt: CUTOVER, now: T("2026-11-03T05:00:00Z") });
    const applied = await applyStudentCredit(db.prisma, ids.student, { actorId: ids.director });
    expect(applied).toHaveLength(1);
    expect(applied[0].amount).toBe(500_000);
    const e = await db.prisma.teacherEarning.findFirstOrThrow({ where: { allocationId: applied[0].id } });
    expect(e.serviceMonth).toBe(11);
    expect(e.earningMonth).toBe(10); // manba to'lov 25-oktabr
    expect(e.rateBp).toBe(4500);
    expect(e.amount).toBe(225_000);
    const settlement = await db.prisma.salaryPeriod.findUniqueOrThrow({ where: { id: e.settlementPeriodId! } });
    expect(settlement.month).toBe(11); // oktabr APPROVED → keyingi ochiq
    expect((await settlementPeriodFor(db.prisma, ids.teacherA, OCT)).month).toBe(11);
  });

  it("CASE D / RULE 6: o'qituvchi almashdi (A → B 1-noyabr); noyabr xizmati B ga, oktabrgacha A ga; ikkalasi KNOWN", async () => {
    const p = db.prisma;
    await p.group.update({ where: { id: ids.group }, data: { teacherId: ids.teacherB } });
    await syncGroupTeacherAssignment(p, ids.group, { at: monthStart(NOV), cutoverAt: CUTOVER, actorId: ids.director });
    const asgs = await p.groupTeacherAssignment.findMany({ where: { groupId: ids.group }, orderBy: { effectiveFrom: "asc" } });
    expect(asgs.map((a) => [a.teacherId, a.effectiveTo?.getTime() ?? null])).toEqual([[ids.teacherA, monthStart(NOV).getTime()], [ids.teacherB, null]]);
    // Noyabr charge'ining qolgan 500k i 5-dekabrda to'landi → B (noyabr xizmati), earningMonth dekabr, GLOBAL 40% (B uchun teacher qoidasi yo'q)
    const r = await pay(ids.student, 500_000, "2026-12-05T05:00:00Z", "earn-case-d-0001");
    const e = await p.teacherEarning.findFirstOrThrow({ where: { sourcePaymentId: r.payment.id } });
    expect(e.teacherId).toBe(ids.teacherB);
    expect(e.serviceMonth).toBe(11);
    expect(e.earningMonth).toBe(12);
    expect(e.rateBp).toBe(4000);
    expect(e.amount).toBe(200_000);
  });

  it("CASE E: MAIN 30% + ASSISTANT 10% → 300k + 100k, dublikat to'liq commission yo'q; Σ ≤ 100%", async () => {
    const p = db.prisma;
    await createSalaryRule(p, { scope: "GROUP", targetId: ids.groupE, component: "PERCENT", rateBp: 3000, effectiveFrom: monthStart(OCT) });
    const asgRule = await createSalaryRule(p, { scope: "ASSIGNMENT", targetId: ids.assistant, component: "PERCENT", rateBp: 1000, effectiveFrom: monthStart(OCT), note: "assistant 10%" });
    await assignTeacher(p, { groupId: ids.groupE, teacherId: ids.assistant, role: "ASSISTANT", effectiveFrom: monthStart(OCT), compensationRuleId: asgRule.id, actorId: ids.director });
    const sum = await groupRateSum(p, ids.groupE, OCT);
    expect(sum).toMatchObject({ totalBp: 5500, ok: true }); // MAIN: TEACHER(45%) GROUP(30%)dan ustun; + assistant 10% = 55%
    const r = await pay(ids.studentE, 1_000_000, "2026-10-15T05:00:00Z", "earn-case-e-0001");
    const es = await p.teacherEarning.findMany({ where: { sourcePaymentId: r.payment.id }, orderBy: { amount: "desc" } });
    expect(es).toHaveLength(2);
    expect(es.map((e) => [e.teacherId === ids.teacherA ? "A" : "AS", e.rateBp, e.amount, e.status])).toEqual([["A", 4500, 450_000, "POSTED"], ["AS", 1000, 100_000, "POSTED"]]);
  });

  it("ASSISTANT qoidasiz → 0 + NEEDS_REVIEW; Σ > 100% → hammasi NEEDS_REVIEW; review POSTED bo'lganda settlement", async () => {
    const p = db.prisma;
    const g = await p.group.create({ data: { name: "G-over", programId: ids.program, branchId: ids.branch, teacherId: ids.teacherA, createdAt: monthStart(OCT) } });
    await syncGroupTeacherAssignment(p, g.id, { at: monthStart(OCT), cutoverAt: CUTOVER });
    const s = await p.student.create({ data: { fullName: "Over", branchId: ids.branch, eduStatus: "ACTIVE", createdAt: monthStart(OCT) } });
    await p.groupStudent.create({ data: { groupId: g.id, studentId: s.id, joinedAt: monthStart(OCT) } });
    // qoidasiz assistant
    await assignTeacher(p, { groupId: g.id, teacherId: ids.teacherB, role: "ASSISTANT", effectiveFrom: monthStart(OCT), actorId: ids.director });
    const r1 = await pay(s.id, 400_000, "2026-10-20T05:00:00Z", "earn-review-0001");
    const es1 = await p.teacherEarning.findMany({ where: { sourcePaymentId: r1.payment.id } });
    const asst = es1.find((e) => e.teacherId === ids.teacherB)!;
    expect(asst.status).toBe("NEEDS_REVIEW");
    expect(asst.reviewReason).toBe("ASSISTANT_NO_RULE");
    expect(asst.amount).toBe(0);
    expect(asst.settlementPeriodId).toBeNull();
    expect(es1.find((e) => e.teacherId === ids.teacherA)?.status).toBe("POSTED");

    // Σ > 100%: assistant 60% qoidasi bilan (A 45% + 60%)
    const big = await createSalaryRule(p, { scope: "ASSIGNMENT", targetId: ids.teacherB, component: "PERCENT", rateBp: 6000, effectiveFrom: monthStart(OCT) });
    await p.groupTeacherAssignment.updateMany({ where: { groupId: g.id, teacherId: ids.teacherB }, data: { compensationRuleId: big.id } });
    expect((await groupRateSum(p, g.id, OCT)).ok).toBe(false);
    const r2 = await pay(s.id, 100_000, "2026-10-21T05:00:00Z", "earn-review-0002");
    const es2 = await p.teacherEarning.findMany({ where: { sourcePaymentId: r2.payment.id } });
    expect(es2.every((e) => e.status === "NEEDS_REVIEW" && e.reviewReason === "RATE_SUM_EXCEEDED")).toBe(true);
    // Admin tasdiqlaydi → POSTED + settlement
    const posted = await postReviewedEarning(p, es2.find((e) => e.teacherId === ids.teacherA)!.id, { userId: ids.director }, "Tekshirildi, to'g'ri");
    expect(posted.status).toBe("POSTED");
    expect(posted.settlementPeriodId).not.toBeNull();
    await expect(postReviewedEarning(p, posted.id, { userId: ids.director }, "yana")).rejects.toThrow(/NEEDS_REVIEW/);
  });

  it("oy o'rtasida MAIN almashishi (D1): ikkita MAIN → ikkalasi NEEDS_REVIEW(AMBIGUOUS_ASSIGNMENT), POSTED yo'q", async () => {
    const p = db.prisma;
    const g = await p.group.create({ data: { name: "G-mid", programId: ids.program, branchId: ids.branch, teacherId: ids.teacherA, createdAt: monthStart(OCT) } });
    await syncGroupTeacherAssignment(p, g.id, { at: monthStart(OCT), cutoverAt: CUTOVER });
    await p.group.update({ where: { id: g.id }, data: { teacherId: ids.teacherB } });
    await syncGroupTeacherAssignment(p, g.id, { at: T("2026-10-15T19:00:00Z"), cutoverAt: CUTOVER }); // 16-oktabrdan B
    const s = await p.student.create({ data: { fullName: "Mid", branchId: ids.branch, eduStatus: "ACTIVE", createdAt: monthStart(OCT) } });
    await p.groupStudent.create({ data: { groupId: g.id, studentId: s.id, joinedAt: monthStart(OCT) } });
    const r = await pay(s.id, 1_000_000, "2026-10-30T05:00:00Z", "earn-mid-0001");
    const es = await p.teacherEarning.findMany({ where: { sourcePaymentId: r.payment.id } });
    expect(es).toHaveLength(2);
    expect(es.every((e) => e.status === "NEEDS_REVIEW" && e.reviewReason === "AMBIGUOUS_ASSIGNMENT")).toBe(true);
    expect(es.every((e) => e.settlementPeriodId === null)).toBe(true);
  });

  it("INFERRED tayinlash (cutover'dan oldin) → NEEDS_REVIEW(LEGACY_INFERRED); qo'lda earning (BONUS/PENALTY) idempotent", async () => {
    const p = db.prisma;
    const g = await p.group.create({ data: { name: "G-legacy", programId: ids.program, branchId: ids.branch, teacherId: ids.teacherA, createdAt: T("2026-05-01T05:00:00Z") } });
    await syncGroupTeacherAssignment(p, g.id, { at: T("2026-10-01T05:00:00Z"), cutoverAt: CUTOVER }); // birinchi yozuv: guruh yaratilgan sanadan → INFERRED
    expect((await p.groupTeacherAssignment.findFirstOrThrow({ where: { groupId: g.id } })).source).toBe("INFERRED");
    const s = await p.student.create({ data: { fullName: "Legacy", branchId: ids.branch, eduStatus: "ACTIVE", createdAt: T("2026-09-01T05:00:00Z") } });
    await p.groupStudent.create({ data: { groupId: g.id, studentId: s.id, joinedAt: T("2026-09-01T05:00:00Z") } });
    const r = await pay(s.id, 300_000, "2026-10-12T05:00:00Z", "earn-legacy-0001");
    const e = await p.teacherEarning.findFirstOrThrow({ where: { sourcePaymentId: r.payment.id } });
    expect(e.status).toBe("NEEDS_REVIEW");
    expect(e.reviewReason).toBe("LEGACY_INFERRED");
    expect(e.amount).toBe(120_000); // hisoblangan, lekin POSTED emas

    const b = await createManualEarning(p, { teacherId: ids.teacherA, type: "BONUS", amount: 200_000, earningMonth: NOV, note: "Oylik bonus", actorId: ids.director, idempotencyKey: "bonus:A:2026-11" });
    const b2 = await createManualEarning(p, { teacherId: ids.teacherA, type: "BONUS", amount: 200_000, earningMonth: NOV, note: "Oylik bonus", actorId: ids.director, idempotencyKey: "bonus:A:2026-11" });
    expect(b2.id).toBe(b.id);
    await expect(createManualEarning(p, { teacherId: ids.teacherA, type: "PENALTY", amount: 50_000, earningMonth: NOV, note: "Kechikish", actorId: ids.director, idempotencyKey: "pen:1" })).rejects.toThrow(/manfiy/);
    const pen = await createManualEarning(p, { teacherId: ids.teacherA, type: "PENALTY", amount: -50_000, earningMonth: NOV, note: "Kechikish", actorId: ids.director, idempotencyKey: "pen:A:2026-11" });
    expect(pen.amount).toBe(-50_000);
  });
});
