import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accountForMethod } from "@/lib/finance/accounts/accounts";
import { FinanceError } from "@/lib/finance/errors";
import { backfillSalary } from "@/lib/finance/ops/backfill";
import { acceptPayment } from "@/lib/finance/payments/accept";
import { monthStart } from "@/lib/finance/period";
import { syncGroupTeacherAssignment } from "@/lib/finance/salary/assignments";
import { createManualEarning } from "@/lib/finance/salary/earnings";
import { approveSalaryPeriod, closeSalaryPeriod, createPayout, ensureSalaryPeriod, payoutReminders, periodEarningDetails, periodSummary, recalculateSalaryPeriod, reopenSalaryPeriod } from "@/lib/finance/salary/periods";
import { createSalaryRule } from "@/lib/finance/salary/rules";
import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// Phase 8 — davr oqimi OPEN → CALCULATED → APPROVED → PARTIALLY_PAID → PAID → CLOSED → reopen;
// FIXED + commission + bonus + penalty komponentlari; qisman payout ledger OUT; tasdiqdan keyingi
// earning keyingi davrga; eslatma ro'yxati; legacy TeacherSalary backfill.

const T = (iso: string) => new Date(iso);
const CUTOVER = T("2026-07-31T19:00:00Z");
const AUG = { year: 2026, month: 8 };
const OCT = { year: 2026, month: 10 };

describe("salary period & payout (Phase 8)", () => {
  let db: TestDb;
  let ids: { branch: string; group: string; teacher: string; student: string; director: string; accountant: string };
  let director: { userId: string; role: string; branchId: null };
  let accountant: { userId: string; role: string; branchId: null };

  beforeAll(async () => {
    db = createTestDb("salary-periods");
    const p = db.prisma;
    const branch = await p.branch.create({ data: { name: "Markaz" } });
    const d = await p.user.create({ data: { fullName: "Direktor", email: "d@t.local", passwordHash: "x", role: "DIRECTOR" } });
    const a = await p.user.create({ data: { fullName: "Buxgalter", email: "acc@t.local", passwordHash: "x", role: "ACCOUNTANT" } });
    const teacher = await p.user.create({ data: { fullName: "Akmal", email: "a@t.local", passwordHash: "x", role: "TEACHER", branchId: branch.id } });
    const program = await p.program.create({ data: { name: "IELTS", monthlyFee: 1_000_000 } });
    const group = await p.group.create({ data: { name: "IELTS-12", programId: program.id, branchId: branch.id, teacherId: teacher.id, createdAt: T("2026-08-01T05:00:00Z") } });
    const student = await p.student.create({ data: { fullName: "Ali", branchId: branch.id, eduStatus: "ACTIVE", createdAt: T("2026-10-01T05:00:00Z") } });
    await p.groupStudent.create({ data: { groupId: group.id, studentId: student.id, joinedAt: T("2026-10-01T05:00:00Z") } });
    await syncGroupTeacherAssignment(p, group.id, { at: T("2026-08-01T05:00:00Z"), cutoverAt: CUTOVER });
    await createSalaryRule(p, { scope: "GLOBAL", component: "PERCENT", rateBp: 4000, effectiveFrom: monthStart(AUG) });
    await createSalaryRule(p, { scope: "TEACHER", targetId: teacher.id, component: "FIXED", fixedAmount: 2_000_000, effectiveFrom: monthStart(AUG) });
    ids = { branch: branch.id, group: group.id, teacher: teacher.id, student: student.id, director: d.id, accountant: a.id };
    director = { userId: d.id, role: "DIRECTOR", branchId: null };
    accountant = { userId: a.id, role: "ACCOUNTANT", branchId: null };
  });

  afterAll(async () => {
    await db.dispose();
  });

  it("oktabr: commission 400k + FIXED 2M + bonus 200k − penalty 50k = 2.55M; recalc → CALCULATED; approve (ACCOUNTANT rad, DIRECTOR ok)", async () => {
    const p = db.prisma;
    await acceptPayment(p, { studentId: ids.student, amount: 1_000_000, method: "CASH", receivedAt: T("2026-10-10T05:00:00Z"), purpose: "Kurs", idempotencyKey: "sp-pay-0001" }, director, T("2026-10-10T05:00:00Z"));
    await createManualEarning(p, { teacherId: ids.teacher, type: "BONUS", amount: 200_000, earningMonth: OCT, note: "Bonus", actorId: ids.director, idempotencyKey: "sp-bonus-oct" });
    await createManualEarning(p, { teacherId: ids.teacher, type: "PENALTY", amount: -50_000, earningMonth: OCT, note: "Kechikish", actorId: ids.director, idempotencyKey: "sp-pen-oct" });
    const period = await recalculateSalaryPeriod(p, ids.teacher, OCT, { userId: ids.director });
    expect(period.status).toBe("CALCULATED");
    expect(period).toMatchObject({ fixedAmount: 2_000_000, commissionAmount: 400_000, bonusAmount: 200_000, penaltyAmount: 50_000, grossAmount: 2_550_000, paidAmount: 0, remainingAmount: 2_550_000 });
    // FIXED idempotent
    await recalculateSalaryPeriod(p, ids.teacher, OCT, { userId: ids.director });
    expect(await p.teacherEarning.count({ where: { teacherId: ids.teacher, type: "FIXED" } })).toBe(1);
    const details = await periodEarningDetails(p, period.id);
    expect(details.map((d) => d.type).sort()).toEqual(["BONUS", "FIXED", "PAYMENT_COMMISSION", "PENALTY"]);
    const comm = details.find((d) => d.type === "PAYMENT_COMMISSION")!;
    expect(comm).toMatchObject({ studentName: "Ali", servicePeriod: "2026-10", earningMonth: "2026-10", allocatedAmount: 1_000_000, rateBp: 4000, amount: 400_000, groupName: "IELTS-12", programName: "IELTS" });
    await expect(approveSalaryPeriod(p, period.id, accountant)).rejects.toThrow(FinanceError); // SALARY_APPROVE yo'q
    const approved = await approveSalaryPeriod(p, period.id, director, "Tekshirildi");
    expect(approved.status).toBe("APPROVED");
    expect(approved.approvedById).toBe(ids.director);
    await expect(recalculateSalaryPeriod(p, ids.teacher, OCT, { userId: ids.director })).rejects.toThrow(/reopen/);
  });

  it("payout: qisman 1.5M (PARTIALLY_PAID) → 1.05M (PAID); ledger OUT; qoldiqdan katta rad; idempotent; ACCOUNTANT to'laydi", async () => {
    const p = db.prisma;
    const period = await ensureSalaryPeriod(p, ids.teacher, OCT);
    const cash = await accountForMethod(p, ids.branch, "CASH");
    await expect(createPayout(p, { salaryPeriodId: period.id, amount: 3_000_000, financialAccountId: cash.id, paidAt: T("2026-11-01T05:00:00Z"), idempotencyKey: "sp-payout-too-much" }, accountant, T("2026-11-01T05:00:00Z"))).rejects.toThrow(/qoldiq/i);
    const p1 = await createPayout(p, { salaryPeriodId: period.id, amount: 1_500_000, financialAccountId: cash.id, paidAt: T("2026-11-01T05:00:00Z"), idempotencyKey: "sp-payout-0001" }, accountant, T("2026-11-01T05:00:00Z"));
    expect(p1.period.status).toBe("PARTIALLY_PAID");
    expect(p1.period.remainingAmount).toBe(1_050_000);
    const led = await p.financialTransaction.findFirstOrThrow({ where: { referenceType: "SalaryPayout", referenceId: p1.payout.id } });
    expect(led).toMatchObject({ direction: "OUT", type: "SALARY_PAYOUT", amount: 1_500_000, accountId: cash.id });
    const replay = await createPayout(p, { salaryPeriodId: period.id, amount: 1_500_000, financialAccountId: cash.id, paidAt: T("2026-11-01T05:00:00Z"), idempotencyKey: "sp-payout-0001" }, accountant, T("2026-11-01T05:00:00Z"));
    expect(replay.replayed).toBe(true);
    expect(await p.salaryPayout.count()).toBe(1);
    // Eslatma: qoldiq bor
    expect((await payoutReminders(p, OCT)).map((r) => r.remaining)).toEqual([1_050_000]);
    const p2 = await createPayout(p, { salaryPeriodId: period.id, amount: 1_050_000, financialAccountId: cash.id, paidAt: T("2026-11-02T05:00:00Z"), idempotencyKey: "sp-payout-0002" }, accountant, T("2026-11-02T05:00:00Z"));
    expect(p2.period.status).toBe("PAID");
    expect(p2.period.remainingAmount).toBe(0);
    expect(await payoutReminders(p, OCT)).toEqual([]);
    await expect(createPayout(p, { salaryPeriodId: period.id, amount: 1, financialAccountId: cash.id, paidAt: T("2026-11-02T05:00:00Z"), idempotencyKey: "sp-payout-0003" }, { userId: "m", role: "MANAGER", branchId: ids.branch })).rejects.toThrow(FinanceError);
  });

  it("tasdiqdan keyingi earning KEYINGI ochiq davrga; close faqat qoldiq 0; reopen DIRECTOR + sabab; CLOSED davr summasi o'zgarmaydi", async () => {
    const p = db.prisma;
    const oct = await ensureSalaryPeriod(p, ids.teacher, OCT);
    // Oktabr APPROVED/PAID — 20-oktabrdagi (kech kiritilgan) to'lov earning'i oktabr oyida, lekin settlement noyabr
    const late = await acceptPayment(p, { studentId: ids.student, amount: 500_000, method: "CASH", receivedAt: T("2026-10-20T05:00:00Z"), purpose: "Kech", idempotencyKey: "sp-pay-late" }, director, T("2026-11-05T05:00:00Z"));
    const e = await p.teacherEarning.findFirstOrThrow({ where: { sourcePaymentId: late.payment.id } });
    expect(e.earningMonth).toBe(10);
    const nov = await p.salaryPeriod.findUniqueOrThrow({ where: { id: e.settlementPeriodId! } });
    expect(nov.month).toBe(11);
    expect((await periodSummary(p, oct.id)).grossAmount).toBe(2_550_000); // PAID davr o'zgarmadi

    await expect(closeSalaryPeriod(p, nov.id, director, "Yopamiz")).rejects.toThrow(/tasdiqlang|Qoldiq/); // tasdiqlanmagan va qoldiqli davr yopilmaydi
    const closed = await closeSalaryPeriod(p, oct.id, director, "Oy yakunlandi");
    expect(closed.status).toBe("CLOSED");
    await expect(closeSalaryPeriod(p, oct.id, director, "yana")).rejects.toThrow(/yopiq/);
    await expect(reopenSalaryPeriod(p, oct.id, accountant, "Tuzatish")).rejects.toThrow(FinanceError); // faqat DIRECTOR
    const reopened = await reopenSalaryPeriod(p, oct.id, director, "Tuzatish kerak");
    expect(reopened.status).toBe("CALCULATED");
    expect(reopened.reopenReason).toBe("Tuzatish kerak");
    const audit = await p.auditLog.findMany({ where: { entityType: "SalaryPeriod", entityId: oct.id }, orderBy: { createdAt: "asc" } });
    expect(audit.map((a) => a.action)).toEqual(["CALCULATE", "CALCULATE", "APPROVE", "CLOSE", "REOPEN"]);
  });

  it("legacy TeacherSalary → SalaryPeriod{LEGACY}: closed → CLOSED (majburiyat emas), ochiq → CALCULATED; idempotent; band oy → conflict", async () => {
    const p = db.prisma;
    const t2 = await p.user.create({ data: { fullName: "Legacy T", email: "lt@t.local", passwordHash: "x", role: "TEACHER" } });
    await p.teacherSalary.create({ data: { teacherId: t2.id, year: 2026, month: 8, fiksa: 3_000_000, bonus: 100_000, penalty: 20_000, kpi: 0, closed: true } });
    const open = await p.teacherSalary.create({ data: { teacherId: t2.id, year: 2026, month: 9, fiksa: 3_000_000, bonus: 0, penalty: 0, kpi: 50_000, closed: false } });
    await p.teacherSalary.create({ data: { teacherId: ids.teacher, year: 2026, month: 10, fiksa: 1, closed: true } }); // V2 davri band
    const dry = await backfillSalary(p, { dryRun: true });
    expect(dry).toMatchObject({ rows: 3, created: 2, conflicts: [{ period: "2026-10" }] });
    expect(await p.salaryPeriod.count({ where: { source: "LEGACY" } })).toBe(0);
    const r = await backfillSalary(p);
    expect(r.created).toBe(2);
    const aug = await p.salaryPeriod.findUniqueOrThrow({ where: { teacherId_year_month: { teacherId: t2.id, year: 2026, month: 8 } } });
    expect(aug).toMatchObject({ source: "LEGACY", status: "CLOSED", legacyFiksaAmount: 3_000_000, grossAmount: 3_080_000, remainingAmount: 0 });
    const sep = await p.salaryPeriod.findUniqueOrThrow({ where: { teacherId_year_month: { teacherId: t2.id, year: 2026, month: 9 } } });
    expect(sep).toMatchObject({ status: "CALCULATED", grossAmount: 3_050_000, remainingAmount: 3_050_000 });
    const again = await backfillSalary(p);
    expect(again).toMatchObject({ created: 0, existing: 2 });
    // Yopiq legacy davr — earning yo'q (majburiyat emas); OCHIQ legacy davr — summa LEGACY earning bilan tasdiqlangan:
    // recalc/approve uni 0 ga tushirmaydi va to'lab bo'ladi (idempotent: ikkinchi backfill qo'shmaydi)
    const es = await p.teacherEarning.findMany({ where: { teacherId: t2.id } });
    expect(es).toHaveLength(1);
    expect(es[0]).toMatchObject({ type: "MANUAL_ADJUSTMENT", status: "POSTED", amount: 3_050_000, settlementPeriodId: sep.id, idempotencyKey: `legacy-salary:${open.id}` });
    const recalced = await recalculateSalaryPeriod(p, t2.id, { year: 2026, month: 9 }, { userId: ids.director });
    expect(recalced).toMatchObject({ grossAmount: 3_050_000, remainingAmount: 3_050_000, status: "CALCULATED" });
  });
});
