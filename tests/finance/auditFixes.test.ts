import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ensureDefaultAccounts, updateAccount } from "@/lib/finance/accounts/accounts";
import { createTransfer } from "@/lib/finance/accounts/transfers";
import { FinanceError } from "@/lib/finance/errors";
import { acceptPayment } from "@/lib/finance/payments/accept";
import { closePeriod } from "@/lib/finance/payments/periodLock";
import { monthStart, type YearMonth } from "@/lib/finance/period";
import { createRefund } from "@/lib/finance/refunds/refund";
import { setMembershipStart } from "@/lib/finance/billing/history";
import { syncStudentBilling } from "@/lib/finance/billing/sync";
import { assignTeacher, assignmentsForService } from "@/lib/finance/salary/assignments";
import { createManualEarning, postReviewedEarning, rejectReviewedEarning } from "@/lib/finance/salary/earnings";
import { approveSalaryPeriod, closeSalaryPeriod, createPayout, periodSummary, recalculateSalaryPeriod } from "@/lib/finance/salary/periods";
import { createSalaryRule, resolveRule } from "@/lib/finance/salary/rules";
import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// PRE-CUTOVER AUDIT tuzatishlari — adversarial review topilmalari uchun regressiya testlari.

const T = (iso: string) => new Date(iso);
const AUG: YearMonth = { year: 2026, month: 8 };
const SEP: YearMonth = { year: 2026, month: 9 };
const OCT: YearMonth = { year: 2026, month: 10 };
const NOV: YearMonth = { year: 2026, month: 11 };
const DEC: YearMonth = { year: 2026, month: 12 };
const FEE = 1_000_000;

describe("audit fixes (pre-cutover)", () => {
  let db: TestDb;
  let ids: { branch: string; program: string; director: string; cash: string; bank: string };
  let director: { userId: string; role: string; branchId: null };
  let accountant: { userId: string; role: string; branchId: null };
  let n = 0;
  const key = (s: string) => `fix-${s}-${String(++n).padStart(4, "0")}`;

  async function mkTeacher(name: string) {
    return db.prisma.user.create({ data: { fullName: name, email: `${name.toLowerCase()}-${n++}@t.local`, passwordHash: "x", role: "TEACHER", branchId: ids.branch } });
  }
  async function mkGroup(name: string, teacherId: string, createdAt = monthStart(AUG), withAssignment = true) {
    const g = await db.prisma.group.create({ data: { name, programId: ids.program, branchId: ids.branch, teacherId, createdAt } });
    if (withAssignment) await assignTeacher(db.prisma, { groupId: g.id, teacherId, role: "MAIN", effectiveFrom: createdAt, actorId: ids.director });
    return g;
  }
  async function mkStudent(groupId: string, joinedAt: Date, name: string) {
    const s = await db.prisma.student.create({ data: { fullName: name, branchId: ids.branch, eduStatus: "ACTIVE", createdAt: joinedAt } });
    await db.prisma.groupStudent.create({ data: { groupId, studentId: s.id, joinedAt } });
    return s;
  }
  const pay = (studentId: string, amount: number, at: string) =>
    acceptPayment(db.prisma, { studentId, amount, method: "CASH", receivedAt: T(at), purpose: "Kurs", idempotencyKey: key("pay") }, director, T(at));

  beforeAll(async () => {
    db = createTestDb("audit-fixes");
    const p = db.prisma;
    const branch = await p.branch.create({ data: { name: "Markaz" } });
    const d = await p.user.create({ data: { fullName: "Direktor", email: "d@t.local", passwordHash: "x", role: "DIRECTOR" } });
    const a = await p.user.create({ data: { fullName: "Buxgalter", email: "acc@t.local", passwordHash: "x", role: "ACCOUNTANT" } });
    const program = await p.program.create({ data: { name: "P", monthlyFee: FEE } });
    const accounts = await ensureDefaultAccounts(p, branch.id, d.id);
    await createSalaryRule(p, { scope: "GLOBAL", component: "PERCENT", rateBp: 4000, effectiveFrom: monthStart(AUG), actorId: d.id });
    ids = { branch: branch.id, program: program.id, director: d.id, cash: accounts.find((x) => x.type === "MAIN_CASH")!.id, bank: accounts.find((x) => x.type === "BANK")!.id };
    director = { userId: d.id, role: "DIRECTOR", branchId: null };
    accountant = { userId: a.id, role: "ACCOUNTANT", branchId: null };
  });

  afterAll(async () => {
    await db.dispose();
  });

  it("legacy guruh (tayinlash tarixi yo'q): allocation'da o'z-o'zidan INFERRED→KNOWN interval yaratiladi; oktabr earning KNOWN → POSTED, sentabr xizmati LEGACY emas (cutover avgust) — INFERRED", async () => {
    const p = db.prisma;
    const t = await mkTeacher("LegacyT");
    const g = await mkGroup("LG-01", t.id, T("2026-05-01T05:00:00Z"), false); // tarix yo'q, cutover (avg) dan oldin yaratilgan
    const s = await mkStudent(g.id, monthStart(OCT), "LG-student");
    const r = await pay(s.id, FEE, "2026-10-05T05:00:00Z");
    const asg = await p.groupTeacherAssignment.findMany({ where: { groupId: g.id }, orderBy: { effectiveFrom: "asc" } });
    expect(asg.map((x) => [x.source, x.effectiveTo === null])).toEqual([["INFERRED", false], ["KNOWN", true]]); // o'tmish INFERRED, kuzatilgan lahzadan KNOWN
    const es = await p.teacherEarning.findMany({ where: { sourcePaymentId: r.payment.id } });
    expect(es).toHaveLength(1); // bir o'qituvchi, ikki interval = BITTA earning (AMBIGUOUS emas)
    expect(es[0]).toMatchObject({ teacherId: t.id, amount: 400_000, status: "POSTED", reviewReason: null });
    // Oktabr xizmatiga KNOWN interval tegadi (kuzatilgan lahzadan ochiq) — INFERRED ham tegishi mumkin (sync vaqtiga bog'liq)
    const oct = await assignmentsForService(p, g.id, OCT);
    expect(oct.some((a) => a.source === "KNOWN" && a.effectiveTo === null)).toBe(true);
  });

  it("assignTeacher(MAIN) oldingi MAIN intervalini yopadi (almashtirish); replaceMain:false → ikki MAIN = NEEDS_REVIEW", async () => {
    const p = db.prisma;
    const t1 = await mkTeacher("Main1"); const t2 = await mkTeacher("Main2"); const t3 = await mkTeacher("Main3");
    const g = await mkGroup("RM-01", t1.id);
    await assignTeacher(p, { groupId: g.id, teacherId: t2.id, role: "MAIN", effectiveFrom: monthStart(OCT), actorId: ids.director });
    const open = await p.groupTeacherAssignment.findMany({ where: { groupId: g.id, effectiveTo: null } });
    expect(open.map((x) => x.teacherId)).toEqual([t2.id]);
    await assignTeacher(p, { groupId: g.id, teacherId: t3.id, role: "MAIN", effectiveFrom: monthStart(NOV), replaceMain: false, actorId: ids.director });
    expect((await p.groupTeacherAssignment.count({ where: { groupId: g.id, effectiveTo: null } }))).toBe(2);
    const s = await mkStudent(g.id, monthStart(NOV), "RM-student");
    const r = await pay(s.id, FEE, "2026-11-05T05:00:00Z");
    const es = await p.teacherEarning.findMany({ where: { sourcePaymentId: r.payment.id } });
    expect(es.every((e) => e.status === "NEEDS_REVIEW" && e.reviewReason === "AMBIGUOUS_ASSIGNMENT")).toBe(true);
    // Rad etish: bittasi POSTED, bittasi REJECTED — ikki to'liq komissiya yo'q; tasdiq bloklanmaydi
    const [keep, drop] = es;
    await postReviewedEarning(p, keep.id, { userId: ids.director }, "Asosiy o'qituvchi");
    await rejectReviewedEarning(p, drop.id, { userId: ids.director }, "Ikkinchi MAIN xato tayinlangan");
    expect((await p.teacherEarning.findUniqueOrThrow({ where: { id: drop.id } })).status).toBe("REJECTED");
    const period = await recalculateSalaryPeriod(p, keep.teacherId, NOV, { userId: ids.director });
    expect(period.grossAmount).toBe(400_000);
    const sum = await periodSummary(p, period.id);
    expect(sum.needsReviewCount).toBe(0);
  });

  it("tasdiq faqat shu davrgacha bo'lgan NEEDS_REVIEW bilan bloklanadi; keyingi oyning ko'rib chiqilmagani to'sqinlik qilmaydi", async () => {
    const p = db.prisma;
    const t = await mkTeacher("ScopeT");
    const g = await mkGroup("SC-01", t.id);
    const s = await mkStudent(g.id, monthStart(OCT), "SC-student");
    await pay(s.id, FEE, "2026-10-05T05:00:00Z"); // okt: 400k POSTED
    // dekabr uchun NEEDS_REVIEW (kelajak oy) — sun'iy: ASSISTANT qoidasiz
    const asst = await mkTeacher("ScopeAsst");
    await assignTeacher(p, { groupId: g.id, teacherId: asst.id, role: "ASSISTANT", effectiveFrom: monthStart(DEC), actorId: ids.director });
    const s2 = await mkStudent(g.id, monthStart(DEC), "SC-student-2");
    const r2 = await pay(s2.id, FEE, "2026-12-05T05:00:00Z");
    expect(await p.teacherEarning.count({ where: { sourcePaymentId: r2.payment.id, status: "NEEDS_REVIEW", teacherId: asst.id } })).toBe(1);
    const period = await recalculateSalaryPeriod(p, asst.id, OCT, { userId: ids.director }); // yordamchining oktabr davri (bo'sh)
    expect((await periodSummary(p, period.id)).needsReviewCount).toBe(0); // dekabrgi review oktabrni bloklamaydi
    const dec = await recalculateSalaryPeriod(p, asst.id, DEC, { userId: ids.director });
    expect((await periodSummary(p, dec.id)).needsReviewCount).toBe(1);
  });

  it("payout yopiq moliya oyiga yozilmaydi (FinancePeriodLock); manfiy qoldiqli davr yopilganda carry-forward keyingi davrga", async () => {
    const p = db.prisma;
    const t = await mkTeacher("CarryT");
    const g = await mkGroup("CF-01", t.id);
    const s = await mkStudent(g.id, monthStart(OCT), "CF-student");
    const r = await pay(s.id, FEE, "2026-10-05T05:00:00Z");
    const period = await recalculateSalaryPeriod(p, t.id, OCT, { userId: ids.director });
    await approveSalaryPeriod(p, period.id, director);
    await closePeriod(p, { branchId: null, ym: SEP, reason: "Sentabr yopiq", actorId: ids.director });
    await expect(createPayout(p, { salaryPeriodId: period.id, amount: 400_000, financialAccountId: ids.cash, paidAt: T("2026-09-25T05:00:00Z"), idempotencyKey: key("po-locked") }, director, T("2026-10-30T05:00:00Z"))).rejects.toThrow(/yopiq/);
    await createPayout(p, { salaryPeriodId: period.id, amount: 400_000, financialAccountId: ids.cash, paidAt: T("2026-11-01T05:00:00Z"), idempotencyKey: key("po") }, director, T("2026-11-01T05:00:00Z"));
    await closeSalaryPeriod(p, period.id, director, "Oktabr yopildi");
    // Qaytarim → noyabr davri −120k; noyabr davrini yopish → carry-forward dekabrga
    await createRefund(p, { paymentId: r.payment.id, amount: 300_000, reason: "Qaytarim", refundedAt: T("2026-11-03T05:00:00Z"), idempotencyKey: key("ref") }, director, T("2026-11-03T05:00:00Z"));
    const nov = await recalculateSalaryPeriod(p, t.id, NOV, { userId: ids.director });
    expect(nov).toMatchObject({ grossAmount: -120_000, remainingAmount: -120_000 });
    await approveSalaryPeriod(p, nov.id, director);
    const closed = await closeSalaryPeriod(p, nov.id, director, "Noyabr yopildi (manfiy → dekabrga)");
    expect(closed).toMatchObject({ status: "CLOSED", grossAmount: 0, remainingAmount: 0 });
    const dec = await recalculateSalaryPeriod(p, t.id, DEC, { userId: ids.director });
    expect(dec.grossAmount).toBe(-120_000); // carry-in
    expect(await p.teacherEarning.count({ where: { idempotencyKey: { in: [`carry-out:${nov.id}`, `carry-in:${nov.id}`] } } })).toBe(2);
  });

  it("qaytarim tuzatishi asl komissiya NEEDS_REVIEW bo'lsa alohida POSTED bo'lmaydi; asl tasdiqlansa tuzatish ham tasdiqlanadi", async () => {
    const p = db.prisma;
    const t = await mkTeacher("AdjT"); const asst = await mkTeacher("AdjAsst");
    const g = await mkGroup("AJ-01", t.id);
    await assignTeacher(p, { groupId: g.id, teacherId: asst.id, role: "ASSISTANT", effectiveFrom: monthStart(OCT), actorId: ids.director }); // qoidasiz → NEEDS_REVIEW
    const s = await mkStudent(g.id, monthStart(OCT), "AJ-student");
    const r = await pay(s.id, FEE, "2026-10-05T05:00:00Z");
    const ref = await createRefund(p, { paymentId: r.payment.id, amount: 500_000, reason: "Yarim qaytarim", refundedAt: T("2026-10-10T05:00:00Z"), idempotencyKey: key("ref2") }, director, T("2026-10-10T05:00:00Z"));
    const asstOrig = await p.teacherEarning.findFirstOrThrow({ where: { sourcePaymentId: r.payment.id, teacherId: asst.id, type: "PAYMENT_COMMISSION" } });
    expect(asstOrig.status).toBe("NEEDS_REVIEW");
    const asstAdj = ref.adjustments.find((a) => a.teacherId === asst.id);
    expect(asstAdj).toBeUndefined(); // qoidasiz (rateBp null) → tuzatish yo'q
    // MAIN: asl POSTED, tuzatish POSTED
    const mainAdj = ref.adjustments.find((a) => a.teacherId === t.id)!;
    expect(mainAdj).toMatchObject({ amount: -200_000, status: "POSTED" });
    // Σ tuzatish ≤ asl: ikkinchi qaytarim (qolgan 500k) → yana −200k, uchinchisi mumkin emas (limit)
    const ref2 = await createRefund(p, { paymentId: r.payment.id, amount: 500_000, reason: "Qolgani", refundedAt: T("2026-10-11T05:00:00Z"), idempotencyKey: key("ref3") }, director, T("2026-10-11T05:00:00Z"));
    expect(ref2.adjustments.find((a) => a.teacherId === t.id)!.amount).toBe(-200_000);
    const sumAdj = await p.teacherEarning.aggregate({ _sum: { amount: true }, where: { reversalOfId: mainAdj.reversalOfId!, type: "REFUND_ADJUSTMENT" } });
    expect(sumAdj._sum.amount).toBe(-400_000);
  });

  it("legacy PERCENT qoida 0..100 dan tashqarida → e'tiborsiz (dvigatel tashlamaydi); ASSIGNMENT faqat PERCENT; endSalaryRule tekshiruvi", async () => {
    const p = db.prisma;
    const t = await mkTeacher("BadRuleT");
    await p.salaryRule.create({ data: { scope: "TEACHER", amountType: "PERCENT", amount: 1500, targetId: t.id, targetName: "xato" } }); // legacy: 1500% = xato
    const view = await resolveRule(p, { serviceMonth: OCT, teacherId: t.id }, "PERCENT");
    expect(view?.scope).toBe("GLOBAL"); // yaroqsiz TEACHER qoidasi o'tkazib yuborildi, GLOBAL 40% qoldi
    await expect(createSalaryRule(p, { scope: "ASSIGNMENT", targetId: t.id, component: "FIXED", fixedAmount: 100, effectiveFrom: monthStart(OCT) })).rejects.toThrow(/PERCENT/);
    const r = await createSalaryRule(p, { scope: "TEACHER", targetId: t.id, component: "PERCENT", rateBp: 3000, effectiveFrom: monthStart(OCT) });
    const { endSalaryRule } = await import("@/lib/finance/salary/rules");
    await expect(endSalaryRule(p, r.id, monthStart(OCT))).rejects.toThrow(/keyin/);
    await expect(endSalaryRule(p, r.id, monthStart(SEP))).rejects.toThrow(/keyin/);
  });

  it("transfer: manfiy balans faqat FINANCE_PERIOD_CLOSE ruxsati + izoh bilan; qabul qiluvchi filial oyi ham ochiq; balansli kassa nofaol qilinmaydi", async () => {
    const p = db.prisma;
    await expect(createTransfer(p, { fromAccountId: ids.bank, toAccountId: ids.cash, amount: 50_000, occurredAt: T("2026-10-20T05:00:00Z"), allowNegative: true, idempotencyKey: key("tr-neg-noreason") }, director, T("2026-10-20T05:00:00Z"))).rejects.toThrow(/izoh/);
    const tr = await createTransfer(p, { fromAccountId: ids.bank, toAccountId: ids.cash, amount: 50_000, occurredAt: T("2026-10-20T05:00:00Z"), allowNegative: true, note: "Vaqtincha qarz", idempotencyKey: key("tr-neg") }, accountant, T("2026-10-20T05:00:00Z"));
    expect(tr.transfer.amount).toBe(50_000);
    await expect(updateAccount(p, { id: ids.bank, isActive: false })).rejects.toThrow(/Balansi 0 bo'lmagan/);
    // Qabul qiluvchi filial (boshqa filial kassasi) oyi yopiq → rad
    const b2 = await p.branch.create({ data: { name: "Filial-2" } });
    const acc2 = (await ensureDefaultAccounts(p, b2.id, ids.director)).find((x) => x.type === "MAIN_CASH")!;
    await closePeriod(p, { branchId: b2.id, ym: OCT, reason: "F2 oktabr yopiq", actorId: ids.director });
    await expect(createTransfer(p, { fromAccountId: ids.cash, toAccountId: acc2.id, amount: 1_000, occurredAt: T("2026-10-21T05:00:00Z"), idempotencyKey: key("tr-dest-locked") }, director, T("2026-10-21T05:00:00Z"))).rejects.toThrow(/yopiq/);
  });

  it("manual earning: FIXED/PAYMENT_COMMISSION turi rad etiladi (dvigatel darajasida ham)", async () => {
    const p = db.prisma;
    const t = await mkTeacher("TypeT");
    await expect(createManualEarning(p, { teacherId: t.id, type: "FIXED" as never, amount: 1, earningMonth: OCT, note: "x", actorId: ids.director, idempotencyKey: key("me-fixed") })).rejects.toThrow(FinanceError);
    await expect(createManualEarning(p, { teacherId: t.id, type: "PAYMENT_COMMISSION" as never, amount: 1, earningMonth: OCT, note: "x", actorId: ids.director, idempotencyKey: key("me-pc") })).rejects.toThrow(FinanceError);
  });

  it("a'zolik boshlanishini ertaroqqa tuzatish → o'tgan oylar charge'lari; kechroqqa/charge bor bo'lsa rad; audit", async () => {
    const p = db.prisma;
    const t = await mkTeacher("StartT");
    const g = await mkGroup("ST-01", t.id);
    const s = await mkStudent(g.id, monthStart(OCT), "ST-student");
    await syncStudentBilling(p, { studentId: s.id, upTo: OCT, actorId: ids.director, now: T("2026-10-05T05:00:00Z") });
    expect(await p.studentCharge.count({ where: { studentId: s.id } })).toBe(1);
    await expect(setMembershipStart(p, { studentId: s.id, groupId: g.id, from: monthStart(NOV), actorId: ids.director, reason: "Kechroq" })).rejects.toThrow(/ERTAROQ/);
    const r = await setMembershipStart(p, { studentId: s.id, groupId: g.id, from: monthStart(SEP), actorId: ids.director, reason: "Aslida sentabrdan o'qiydi" });
    expect(r.previousFrom.getTime()).toBe(monthStart(OCT).getTime());
    const sync = await syncStudentBilling(p, { studentId: s.id, upTo: OCT, actorId: ids.director, now: T("2026-10-05T05:00:00Z") });
    expect(sync.created.map((c) => c.serviceMonth)).toEqual([9]);
    expect((await p.groupStudent.findFirstOrThrow({ where: { studentId: s.id } })).joinedAt.getTime()).toBe(monthStart(SEP).getTime());
    expect(await p.auditLog.count({ where: { entityType: "GroupStudentHistory", action: "UPDATE" } })).toBeGreaterThanOrEqual(1);
    // Yana ertaroqqa (avgust) — mumkin, avgust charge'i qo'shiladi (keraksiz bo'lsa bekor qilinadi)
    await setMembershipStart(p, { studentId: s.id, groupId: g.id, from: monthStart(AUG), actorId: ids.director, reason: "Avgustdan" });
    expect((await syncStudentBilling(p, { studentId: s.id, upTo: OCT, actorId: ids.director, now: T("2026-10-05T05:00:00Z") })).created.map((c) => c.serviceMonth)).toEqual([8]);
  });
});
