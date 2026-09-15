import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { FinanceError } from "@/lib/finance/errors";
import { monthStart } from "@/lib/finance/period";
import { attendanceRatio } from "@/lib/finance/salary/attendance";
import { computeEligibility } from "@/lib/finance/salary/eligibility";
import { createSalaryPolicyVersion, resolveSalaryPolicy, salaryPolicyHistory, DEFAULT_SALARY_POLICY } from "@/lib/finance/salary/policy";
import { createSalaryRule, endSalaryRule, resolveRule, toRuleView } from "@/lib/finance/salary/rules";
import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// Phase 5 — siyosat versiyalari (BRANCH → GLOBAL, xizmat oyi), qoida priority (RULE 8),
// legacy ALL qoidasi, davomat nisbati, eligibility (holat, davomat, NO_LESSONS → review).

const T = (iso: string) => new Date(iso);
const AUG = { year: 2026, month: 8 };
const SEP = { year: 2026, month: 9 };
const OCT = { year: 2026, month: 10 };

describe("salary policy engine (Phase 5)", () => {
  let db: TestDb;
  let ids: { branch: string; branch2: string; program: string; group: string; teacher: string; student: string };

  beforeAll(async () => {
    db = createTestDb("salary-policy");
    const p = db.prisma;
    const branch = await p.branch.create({ data: { name: "Markaz" } });
    const branch2 = await p.branch.create({ data: { name: "Chilonzor" } });
    const teacher = await p.user.create({ data: { fullName: "Akmal", email: "a@t.local", passwordHash: "x", role: "TEACHER" } });
    const program = await p.program.create({ data: { name: "IELTS", monthlyFee: 1_000_000 } });
    const group = await p.group.create({ data: { name: "IELTS-12", programId: program.id, branchId: branch.id, teacherId: teacher.id } });
    const student = await p.student.create({ data: { fullName: "Ali", branchId: branch.id, eduStatus: "ACTIVE", createdAt: T("2026-08-01T05:00:00Z") } });
    await p.studentStatusHistory.create({ data: { studentId: student.id, status: "ACTIVE", effectiveFrom: T("2026-08-01T05:00:00Z") } });
    ids = { branch: branch.id, branch2: branch2.id, program: program.id, group: group.id, teacher: teacher.id, student: student.id };
  });

  afterAll(async () => {
    await db.dispose();
  });

  it("policy: standart → global v1 → filial v1 → global v2; eski versiya mutate emas, effectiveTo bilan", async () => {
    expect(await resolveSalaryPolicy(db.prisma, ids.branch, SEP)).toEqual(DEFAULT_SALARY_POLICY);
    const g1 = await createSalaryPolicyVersion(db.prisma, { name: "Standart", effectiveFrom: monthStart(AUG), salaryBaseMode: "REAL_PAID_AMOUNT" });
    const b1 = await createSalaryPolicyVersion(db.prisma, { name: "Chilonzor", branchId: ids.branch2, effectiveFrom: monthStart(SEP), attendanceMode: "PRESENT_RATIO" });
    const g2 = await createSalaryPolicyVersion(db.prisma, { name: "Standart", effectiveFrom: monthStart(OCT), salaryBaseMode: "FULL_PRICE_EQUIVALENT" });
    expect(g2.version).toBe(2);
    expect((await db.prisma.salaryPolicy.findUniqueOrThrow({ where: { id: g1.id } })).effectiveTo?.getTime()).toBe(monthStart(OCT).getTime());
    expect((await resolveSalaryPolicy(db.prisma, ids.branch, SEP)).id).toBe(g1.id); // sentabr: global v1
    expect((await resolveSalaryPolicy(db.prisma, ids.branch, OCT)).salaryBaseMode).toBe("FULL_PRICE_EQUIVALENT");
    expect((await resolveSalaryPolicy(db.prisma, ids.branch2, SEP)).id).toBe(b1.id); // filial ustun
    expect((await resolveSalaryPolicy(db.prisma, ids.branch2, AUG)).id).toBe(g1.id); // avgust: filial siyosati hali yo'q
    await expect(createSalaryPolicyVersion(db.prisma, { name: "Standart", effectiveFrom: monthStart(SEP) })).rejects.toThrow(FinanceError); // orqaga
    await expect(createSalaryPolicyVersion(db.prisma, { name: "X", effectiveFrom: T("2026-10-05T00:00:00Z") })).rejects.toThrow(/oy boshi/);
    await expect(createSalaryPolicyVersion(db.prisma, { name: "Y", effectiveFrom: monthStart(OCT), noLessonsMode: "NO_LESSONS_AS_FULL" })).rejects.toThrow(/NO_LESSONS_REVIEW/);
    expect((await salaryPolicyHistory(db.prisma, "Standart")).map((p) => p.version)).toEqual([2, 1]);
  });

  it("qoidalar: legacy ALL 40% → GLOBAL 4000bp; supersede; priority STUDENT > TEACHER > GROUP > COURSE > BRANCH > GLOBAL", async () => {
    const p = db.prisma;
    const legacy = await p.salaryRule.create({ data: { scope: "ALL", amountType: "PERCENT", amount: 40, isDefault: true, createdAt: T("2026-07-10T05:00:00Z") } });
    const lv = toRuleView(legacy);
    expect(lv.scope).toBe("GLOBAL");
    expect(lv.rateBp).toBe(4000);
    expect(lv.legacy).toBe(true);
    expect(lv.effectiveFrom.getTime()).toBe(monthStart({ year: 2026, month: 7 }).getTime());
    const ctx = { serviceMonth: SEP, studentId: ids.student, teacherId: ids.teacher, groupId: ids.group, programId: ids.program, branchId: ids.branch };
    expect((await resolveRule(db.prisma, ctx, "PERCENT"))?.id).toBe(legacy.id);

    // GLOBAL 30% oktabrdan — legacy yopiladi (supersede), sentabr uchun hali 40%
    const g30 = await createSalaryRule(db.prisma, { scope: "GLOBAL", component: "PERCENT", rateBp: 3000, effectiveFrom: monthStart(OCT) });
    expect((await p.salaryRule.findUniqueOrThrow({ where: { id: legacy.id } })).supersededById).toBe(g30.id);
    expect((await resolveRule(db.prisma, ctx, "PERCENT"))?.rateBp).toBe(4000);
    expect((await resolveRule(db.prisma, { ...ctx, serviceMonth: OCT }, "PERCENT"))?.rateBp).toBe(3000);

    await createSalaryRule(db.prisma, { scope: "COURSE", targetId: ids.program, component: "PERCENT", rateBp: 3500, effectiveFrom: monthStart(OCT) });
    await createSalaryRule(db.prisma, { scope: "GROUP", targetId: ids.group, component: "PERCENT", rateBp: 4000, effectiveFrom: monthStart(OCT) });
    await createSalaryRule(db.prisma, { scope: "TEACHER", targetId: ids.teacher, component: "PERCENT", rateBp: 4500, effectiveFrom: monthStart(OCT) });
    const st = await createSalaryRule(db.prisma, { scope: "STUDENT", targetId: ids.student, component: "PERCENT", rateBp: 3500, effectiveFrom: monthStart(OCT) });
    const octCtx = { ...ctx, serviceMonth: OCT };
    expect((await resolveRule(db.prisma, octCtx, "PERCENT"))?.rateBp).toBe(3500); // STUDENT
    expect((await resolveRule(db.prisma, { ...octCtx, studentId: null }, "PERCENT"))?.rateBp).toBe(4500); // TEACHER
    expect((await resolveRule(db.prisma, { ...octCtx, studentId: null, teacherId: null }, "PERCENT"))?.rateBp).toBe(4000); // GROUP
    expect((await resolveRule(db.prisma, { ...octCtx, studentId: null, teacherId: null, groupId: null }, "PERCENT"))?.rateBp).toBe(3500); // COURSE
    expect((await resolveRule(db.prisma, { ...octCtx, studentId: null, teacherId: null, groupId: null, programId: null }, "PERCENT"))?.rateBp).toBe(3000); // GLOBAL

    // Assignment-level qoida hammadan ustun
    const asg = await createSalaryRule(db.prisma, { scope: "ASSIGNMENT", targetId: ids.teacher, component: "PERCENT", rateBp: 1000, effectiveFrom: monthStart(OCT), note: "assistant" });
    expect((await resolveRule(db.prisma, octCtx, "PERCENT"))?.rateBp).toBe(3500); // ASSIGNMENT scope umumiy resolve'ga kirmaydi
    expect((await resolveRule(db.prisma, { ...octCtx, assignmentRuleId: asg.id }, "PERCENT"))?.rateBp).toBe(1000);
    // FIXED komponent alohida
    expect(await resolveRule(db.prisma, octCtx, "FIXED")).toBeNull();
    await createSalaryRule(db.prisma, { scope: "TEACHER", targetId: ids.teacher, component: "FIXED", fixedAmount: 2_000_000, effectiveFrom: monthStart(OCT) });
    expect((await resolveRule(db.prisma, octCtx, "FIXED"))?.fixedAmount).toBe(2_000_000);
    // Yopish
    await endSalaryRule(db.prisma, st.id, monthStart({ year: 2026, month: 11 }));
    expect((await resolveRule(db.prisma, { ...ctx, serviceMonth: { year: 2026, month: 11 } }, "PERCENT"))?.rateBp).toBe(4500);
    expect((await resolveRule(db.prisma, octCtx, "PERCENT"))?.rateBp).toBe(3500); // tarixiy: oktabr uchun yopilgan qoida hali amal qiladi
    await expect(createSalaryRule(db.prisma, { scope: "GLOBAL", component: "PERCENT", rateBp: 12_000, effectiveFrom: monthStart(OCT) })).rejects.toThrow();
    await expect(createSalaryRule(db.prisma, { scope: "GROUP", component: "PERCENT", rateBp: 100, effectiveFrom: monthStart(OCT) })).rejects.toThrow(/targetId/);
  });

  it("davomat nisbati va eligibility: NONE → to'liq; PRESENT_RATIO 9/12 → 750k; dars yo'q → NEEDS_REVIEW; FULL_PRICE base", async () => {
    const p = db.prisma;
    const policyNone = { ...DEFAULT_SALARY_POLICY };
    const charge = { originalAmount: 1_000_000, finalAmount: 800_000, groupId: ids.group, studentId: ids.student, serviceMonth: SEP };
    const e0 = await computeEligibility(db.prisma, { policy: policyNone, allocationAmount: 800_000, charge, at: T("2026-10-10T05:00:00Z") });
    expect(e0).toMatchObject({ base: 800_000, eligible: 800_000, studentStatus: "ACTIVE", reviewReason: null });

    const full = { ...DEFAULT_SALARY_POLICY, salaryBaseMode: "FULL_PRICE_EQUIVALENT" };
    expect((await computeEligibility(db.prisma, { policy: full, allocationAmount: 800_000, charge, at: T("2026-10-10T05:00:00Z") })).base).toBe(1_000_000);

    const ratioPolicy = { ...DEFAULT_SALARY_POLICY, attendanceMode: "PRESENT_RATIO" };
    const noLessons = await computeEligibility(db.prisma, { policy: ratioPolicy, allocationAmount: 1_000_000, charge: { ...charge, finalAmount: 1_000_000 }, at: T("2026-10-10T05:00:00Z") });
    expect(noLessons.reviewReason).toBe("NO_LESSONS_FOUND");
    expect(noLessons.eligible).toBe(1_000_000); // summa hisoblangan, lekin review'siz POSTED bo'lmaydi

    // 12 dars, 9 tasida qatnashgan (1 LATE, 1 EXCUSED — hisobga kirmaydi, 2 ABSENT)
    const statuses = [...Array(8).fill("PRESENT"), "LATE", "EXCUSED", "ABSENT", "ABSENT"];
    for (let i = 0; i < 12; i++) {
      const lesson = await p.lesson.create({ data: { groupId: ids.group, startsAt: T(`2026-09-${String(i + 1).padStart(2, "0")}T05:00:00Z`) } });
      await p.attendance.create({ data: { lessonId: lesson.id, studentId: ids.student, status: statuses[i], confirmed: i < 6 } });
    }
    const ar = await attendanceRatio(db.prisma, { studentId: ids.student, groupId: ids.group, serviceMonth: SEP, policy: ratioPolicy });
    expect(ar).toEqual({ lessons: 12, present: 9, ratio: { numerator: 9, denominator: 12 } });
    const e1 = await computeEligibility(db.prisma, { policy: ratioPolicy, allocationAmount: 1_000_000, charge: { ...charge, finalAmount: 1_000_000 }, at: T("2026-10-10T05:00:00Z") });
    expect(e1.eligible).toBe(750_000);
    expect(e1.reviewReason).toBeNull();
    // Faqat ustoz tasdiqlagan davomat: 6 ta tasdiqlangan (hammasi PRESENT) → 6/12
    const confirmedOnly = { ...ratioPolicy, requireConfirmedAttendance: true };
    expect((await computeEligibility(db.prisma, { policy: confirmedOnly, allocationAmount: 1_000_000, charge: { ...charge, finalAmount: 1_000_000 }, at: T("2026-10-10T05:00:00Z") })).eligible).toBe(500_000);

    // ARCHIVED holat, includeArchivedStudents=false → 0
    await p.studentStatusHistory.updateMany({ where: { studentId: ids.student }, data: { effectiveTo: T("2026-10-01T05:00:00Z") } });
    await p.studentStatusHistory.create({ data: { studentId: ids.student, status: "ARCHIVED", effectiveFrom: T("2026-10-01T05:00:00Z") } });
    const excl = { ...DEFAULT_SALARY_POLICY, includeArchivedStudents: false };
    const e2 = await computeEligibility(db.prisma, { policy: excl, allocationAmount: 500_000, charge, at: T("2026-10-10T05:00:00Z") });
    expect(e2).toMatchObject({ studentStatus: "ARCHIVED", eligible: 0 });
    expect((await computeEligibility(db.prisma, { policy: DEFAULT_SALARY_POLICY, allocationAmount: 500_000, charge, at: T("2026-10-10T05:00:00Z") })).eligible).toBe(500_000);
  });
});
