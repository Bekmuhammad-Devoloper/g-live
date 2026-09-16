import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accountForMethod, ensureDefaultAccounts } from "@/lib/finance/accounts/accounts";
import { accountBalance } from "@/lib/finance/accounts/balances";
import { createTransfer } from "@/lib/finance/accounts/transfers";
import { studentBalance } from "@/lib/finance/billing/balance";
import { syncStudentBilling } from "@/lib/finance/billing/sync";
import { createExpense } from "@/lib/finance/expenses/expenses";
import { backfillBilling } from "@/lib/finance/ops/backfill";
import { acceptPayment } from "@/lib/finance/payments/accept";
import { monthStart, type YearMonth } from "@/lib/finance/period";
import { createRefund } from "@/lib/finance/refunds/refund";
import { cashFlow, profitAndLoss } from "@/lib/finance/reports/cashflow";
import { assignTeacher } from "@/lib/finance/salary/assignments";
import { approveSalaryPeriod, closeSalaryPeriod, createPayout, recalculateSalaryPeriod } from "@/lib/finance/salary/periods";
import { createSalaryPolicyVersion } from "@/lib/finance/salary/policy";
import { createSalaryRule } from "@/lib/finance/salary/rules";
import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// PRE-CUTOVER AUDIT — biznes ssenariylar A–L (FINAL qoidalar) end-to-end, bitta bazada, har biri
// alohida guruh/o'quvchi/o'qituvchi bilan izolyatsiyalangan; oxirida pul invariantlari.

const T = (iso: string) => new Date(iso);
const AUG: YearMonth = { year: 2026, month: 8 };
const SEP: YearMonth = { year: 2026, month: 9 };
const OCT: YearMonth = { year: 2026, month: 10 };
const NOV: YearMonth = { year: 2026, month: 11 };
const FEE = 1_000_000;

describe("business scenarios A–L (pre-cutover)", () => {
  let db: TestDb;
  let ids: { branch: string; branch2: string; program: string; director: string; cash: string; bank: string };
  let director: { userId: string; role: string; branchId: null };
  let n = 0;
  const key = (s: string) => `scn-${s}-${String(++n).padStart(4, "0")}`;

  /** guruh + MAIN o'qituvchi (KNOWN tayinlash avgustdan) */
  async function mkGroup(name: string, teacherName: string, branchId = ids.branch, from = monthStart(AUG)) {
    const p = db.prisma;
    const teacher = await p.user.create({ data: { fullName: teacherName, email: `${name.toLowerCase()}-${teacherName.toLowerCase()}@t.local`, passwordHash: "x", role: "TEACHER", branchId } });
    const group = await p.group.create({ data: { name, programId: ids.program, branchId, teacherId: teacher.id, createdAt: from } });
    await assignTeacher(p, { groupId: group.id, teacherId: teacher.id, role: "MAIN", effectiveFrom: from, actorId: ids.director });
    return { group, teacher };
  }
  async function mkStudent(groupId: string, joinedAt: Date, name: string, opts: { eduStatus?: string; branchId?: string } = {}) {
    const p = db.prisma;
    const s = await p.student.create({ data: { fullName: name, branchId: opts.branchId ?? ids.branch, eduStatus: opts.eduStatus ?? "ACTIVE", createdAt: joinedAt } });
    await p.groupStudent.create({ data: { groupId, studentId: s.id, joinedAt } });
    return s;
  }
  const pay = (studentId: string, amount: number, at: string, k: string, method = "CASH") =>
    acceptPayment(db.prisma, { studentId, amount, method, receivedAt: T(at), purpose: "Kurs", idempotencyKey: key(k) }, director, T(at));
  const earningsOf = (paymentId: string) => db.prisma.teacherEarning.findMany({ where: { sourcePaymentId: paymentId }, orderBy: [{ amount: "desc" }, { createdAt: "asc" }] });

  beforeAll(async () => {
    db = createTestDb("scenarios");
    const p = db.prisma;
    const branch = await p.branch.create({ data: { name: "Markaz" } });
    const branch2 = await p.branch.create({ data: { name: "Chilonzor" } });
    const d = await p.user.create({ data: { fullName: "Direktor", email: "d@t.local", passwordHash: "x", role: "DIRECTOR" } });
    const program = await p.program.create({ data: { name: "Nemis A1", monthlyFee: FEE } });
    const accounts = await ensureDefaultAccounts(p, branch.id, d.id);
    await ensureDefaultAccounts(p, branch2.id, d.id);
    await createSalaryRule(p, { scope: "GLOBAL", component: "PERCENT", rateBp: 4000, effectiveFrom: monthStart(AUG), actorId: d.id }); // 40% standart
    await createSalaryPolicyVersion(p, { name: "Standart", effectiveFrom: monthStart(AUG), actorId: d.id });
    ids = { branch: branch.id, branch2: branch2.id, program: program.id, director: d.id, cash: accounts.find((a) => a.type === "MAIN_CASH")!.id, bank: accounts.find((a) => a.type === "BANK")!.id };
    director = { userId: d.id, role: "DIRECTOR", branchId: null };
  });

  afterAll(async () => {
    await db.dispose();
  });

  it("A: 1 000 000 to'lov, o'qituvchi 40% → earning 400 000 (POSTED, serviceMonth=earningMonth=Okt)", async () => {
    const { group, teacher } = await mkGroup("A-01", "TeacherA");
    const s = await mkStudent(group.id, monthStart(OCT), "A-student");
    const r = await pay(s.id, FEE, "2026-10-05T05:00:00Z", "a");
    expect(r.allocations.map((a) => a.amount)).toEqual([FEE]);
    const es = await earningsOf(r.payment.id);
    expect(es).toHaveLength(1);
    expect(es[0]).toMatchObject({ teacherId: teacher.id, amount: 400_000, rateBp: 4000, status: "POSTED", type: "PAYMENT_COMMISSION", serviceYear: 2026, serviceMonth: 10, earningYear: 2026, earningMonth: 10 });
  });

  it("B: 500 000 qisman → 200 000; keyingi 500 000 → yana 200 000; charge PAID", async () => {
    const { group } = await mkGroup("B-01", "TeacherB");
    const s = await mkStudent(group.id, monthStart(OCT), "B-student");
    const r1 = await pay(s.id, 500_000, "2026-10-05T05:00:00Z", "b1");
    const r2 = await pay(s.id, 500_000, "2026-10-20T05:00:00Z", "b2");
    expect((await earningsOf(r1.payment.id)).map((e) => e.amount)).toEqual([200_000]);
    expect((await earningsOf(r2.payment.id)).map((e) => e.amount)).toEqual([200_000]);
    const charge = await db.prisma.studentCharge.findFirstOrThrow({ where: { studentId: s.id, serviceMonth: 10 } });
    expect(charge.status).toBe("PAID");
    expect((await studentBalance(db.prisma, s.id))).toMatchObject({ debt: 0, credit: 0 });
  });

  it("C: sentabr qarzi oktabrda to'lansa — serviceMonth Sen, rate 40% (Sen qoidasi), earningMonth Okt, 400 000; Okt qoidasi 45% qo'llanmaydi", async () => {
    const p = db.prisma;
    const { group, teacher } = await mkGroup("C-01", "TeacherC");
    // Guruh qoidasi: Sen 40%, Okt 45% (yangi versiya eskisini yopadi — mutate emas)
    await createSalaryRule(p, { scope: "GROUP", targetId: group.id, component: "PERCENT", rateBp: 4000, effectiveFrom: monthStart(SEP), actorId: ids.director });
    await createSalaryRule(p, { scope: "GROUP", targetId: group.id, component: "PERCENT", rateBp: 4500, effectiveFrom: monthStart(OCT), actorId: ids.director });
    const s = await mkStudent(group.id, monthStart(SEP), "C-student");
    const r = await pay(s.id, FEE, "2026-10-10T05:00:00Z", "c"); // sentabrda to'lov bo'lmagan → FIFO: sentabr charge birinchi
    const sep = await p.studentCharge.findFirstOrThrow({ where: { studentId: s.id, serviceMonth: 9 } });
    expect(r.allocations).toHaveLength(1);
    expect(r.allocations[0]).toMatchObject({ chargeId: sep.id, amount: FEE });
    const es = await earningsOf(r.payment.id);
    expect(es).toHaveLength(1);
    expect(es[0]).toMatchObject({ teacherId: teacher.id, serviceMonth: 9, earningMonth: 10, rateBp: 4000, amount: 400_000, status: "POSTED" });
    // Oktabr charge ochiq qoladi (qarz 1M) — keyingi to'lov 45% bilan
    expect((await studentBalance(p, s.id)).debt).toBe(FEE);
    const r2 = await pay(s.id, FEE, "2026-10-25T05:00:00Z", "c2");
    expect((await earningsOf(r2.payment.id))[0]).toMatchObject({ serviceMonth: 10, earningMonth: 10, rateBp: 4500, amount: 450_000 });
  });

  it("D: sentabrda oktabr uchun oldindan to'lov → kredit; oktabr charge yaratilganda kredit qo'llanadi: serviceMonth Okt, earningMonth Sen; Sen davri CLOSED → settlement keyingi OPEN (Okt)", async () => {
    const p = db.prisma;
    const { group, teacher } = await mkGroup("D-01", "TeacherD");
    const s = await mkStudent(group.id, monthStart(SEP), "D-student");
    const r1 = await pay(s.id, FEE, "2026-09-05T05:00:00Z", "d1"); // sentabr uchun
    const r2 = await pay(s.id, FEE, "2026-09-20T05:00:00Z", "d2"); // oldindan (oktabr charge hali yo'q)
    expect(r2.allocations).toHaveLength(0);
    expect((await studentBalance(p, s.id))).toMatchObject({ debt: 0, credit: FEE });
    expect(await earningsOf(r2.payment.id)).toHaveLength(0); // taqsimot yo'q → earning yo'q (hali)
    // Sentabr maosh davri: hisob → tasdiq → to'lov → YOPISH (400k = r1 ulushi)
    const period = await recalculateSalaryPeriod(p, teacher.id, SEP, { userId: ids.director });
    expect(period.grossAmount).toBe(400_000);
    await approveSalaryPeriod(p, period.id, director);
    await createPayout(p, { salaryPeriodId: period.id, amount: 400_000, financialAccountId: ids.cash, paidAt: T("2026-10-01T05:00:00Z"), idempotencyKey: key("d-payout") }, director, T("2026-10-01T05:00:00Z"));
    await closeSalaryPeriod(p, period.id, director, "Sentabr yopildi");
    // Oktabr: billing sync → oktabr charge → mavjud kredit qo'llanadi (CREDIT_APPLY, manba = r2)
    const sync = await syncStudentBilling(p, { studentId: s.id, upTo: OCT, actorId: ids.director, now: T("2026-10-02T05:00:00Z") });
    expect(sync.created.map((c) => c.serviceMonth)).toEqual([10]);
    expect(sync.creditApplied).toHaveLength(1);
    expect(sync.creditApplied[0]).toMatchObject({ paymentId: r2.payment.id, amount: FEE, kind: "ALLOCATION", source: "CREDIT_APPLY" });
    expect((await studentBalance(p, s.id))).toMatchObject({ debt: 0, credit: 0 });
    const es = await earningsOf(r2.payment.id);
    expect(es).toHaveLength(1);
    const octPeriod = await p.salaryPeriod.findUniqueOrThrow({ where: { teacherId_year_month: { teacherId: teacher.id, year: 2026, month: 10 } } });
    expect(es[0]).toMatchObject({ serviceMonth: 10, earningMonth: 9, amount: 400_000, status: "POSTED", settlementPeriodId: octPeriod.id });
    // Yopiq sentabr davri o'zgarmagan
    const sepAfter = await p.salaryPeriod.findUniqueOrThrow({ where: { id: period.id } });
    expect(sepAfter).toMatchObject({ status: "CLOSED", grossAmount: 400_000, paidAmount: 400_000 });
    // Idempotent: qayta sync hech narsa qo'shmaydi
    const again = await syncStudentBilling(p, { studentId: s.id, upTo: OCT, actorId: ids.director, now: T("2026-10-03T05:00:00Z") });
    expect(again.created).toHaveLength(0);
    expect(again.creditApplied).toHaveLength(0);
  });

  it("E: 1M to'lov (earning 400k), 300k qaytarim → REFUND_ADJUSTMENT −120k; asl earning o'zgarmaydi", async () => {
    const p = db.prisma;
    const { group, teacher } = await mkGroup("E-01", "TeacherE");
    const s = await mkStudent(group.id, monthStart(OCT), "E-student");
    const r = await pay(s.id, FEE, "2026-10-05T05:00:00Z", "e");
    const orig = (await earningsOf(r.payment.id))[0];
    expect(orig.amount).toBe(400_000);
    const ref = await createRefund(p, { paymentId: r.payment.id, amount: 300_000, reason: "Qisman qaytarim", refundedAt: T("2026-10-12T05:00:00Z"), idempotencyKey: key("e-ref") }, director, T("2026-10-12T05:00:00Z"));
    expect(ref.reversals.map((x) => [x.kind, x.amount])).toEqual([["REVERSAL", 300_000]]);
    expect(ref.adjustments).toHaveLength(1);
    expect(ref.adjustments[0]).toMatchObject({ teacherId: teacher.id, type: "REFUND_ADJUSTMENT", amount: -120_000, reversalOfId: orig.id, earningMonth: 10 });
    const origAfter = await p.teacherEarning.findUniqueOrThrow({ where: { id: orig.id } });
    expect(origAfter).toMatchObject({ amount: 400_000, status: orig.status, settlementPeriodId: orig.settlementPeriodId });
    expect((await studentBalance(p, s.id)).debt).toBe(300_000); // charge qayta ochildi
  });

  it("F: CLOSED/PAID maoshdan keyingi qaytarim eski payout'ni o'zgartirmaydi; −120k keyingi OPEN davrga (Noy)", async () => {
    const p = db.prisma;
    const { group, teacher } = await mkGroup("F-01", "TeacherF");
    const s = await mkStudent(group.id, monthStart(OCT), "F-student");
    const r = await pay(s.id, FEE, "2026-10-05T05:00:00Z", "f");
    const period = await recalculateSalaryPeriod(p, teacher.id, OCT, { userId: ids.director });
    await approveSalaryPeriod(p, period.id, director);
    const po = await createPayout(p, { salaryPeriodId: period.id, amount: 400_000, financialAccountId: ids.cash, paidAt: T("2026-11-01T05:00:00Z"), idempotencyKey: key("f-payout") }, director, T("2026-11-01T05:00:00Z"));
    await closeSalaryPeriod(p, period.id, director, "Oktabr yopildi");
    const ref = await createRefund(p, { paymentId: r.payment.id, amount: 300_000, reason: "Kechikkan qaytarim", refundedAt: T("2026-11-03T05:00:00Z"), idempotencyKey: key("f-ref") }, director, T("2026-11-03T05:00:00Z"));
    const nov = await p.salaryPeriod.findUniqueOrThrow({ where: { teacherId_year_month: { teacherId: teacher.id, year: 2026, month: 11 } } });
    expect(ref.adjustments[0]).toMatchObject({ amount: -120_000, earningMonth: 10, settlementPeriodId: nov.id, status: "POSTED" });
    expect(nov.status).toBe("OPEN");
    const octAfter = await p.salaryPeriod.findUniqueOrThrow({ where: { id: period.id } });
    expect(octAfter).toMatchObject({ status: "CLOSED", grossAmount: 400_000, paidAmount: 400_000, remainingAmount: 0 });
    expect((await p.salaryPayout.findUniqueOrThrow({ where: { id: po.payout.id } })).amount).toBe(400_000);
    const novCalc = await recalculateSalaryPeriod(p, teacher.id, NOV, { userId: ids.director });
    expect(novCalc).toMatchObject({ adjustmentAmount: -120_000, grossAmount: -120_000, paidAmount: 0 }); // o'qituvchi keyingi davrda qaytaradi
  });

  it("G: qarz 1M, to'lov 1.3M → taqsimot 1M, kredit 300k", async () => {
    const { group } = await mkGroup("G-01", "TeacherG");
    const s = await mkStudent(group.id, monthStart(OCT), "G-student");
    const r = await pay(s.id, 1_300_000, "2026-10-05T05:00:00Z", "g");
    expect(r.allocations.map((a) => a.amount)).toEqual([FEE]);
    expect(r.balance).toMatchObject({ debt: 0, credit: 300_000 });
    expect((await earningsOf(r.payment.id)).map((e) => e.amount)).toEqual([400_000]); // faqat taqsimlangan qism
    (globalThis as { __g?: { studentId: string; paymentId: string } }).__g = { studentId: s.id, paymentId: r.payment.id };
  });

  it("H: kredit 300k + yangi charge 1M → qarz 700k; kredit taqsimoti asl to'lovga bog'liq (lineage); earning 120k asl to'lov oyi bilan", async () => {
    const p = db.prisma;
    const g = (globalThis as { __g?: { studentId: string; paymentId: string } }).__g!;
    const sync = await syncStudentBilling(p, { studentId: g.studentId, upTo: NOV, actorId: ids.director, now: T("2026-11-02T05:00:00Z") });
    expect(sync.created.map((c) => c.serviceMonth)).toEqual([11]);
    expect(sync.creditApplied).toHaveLength(1);
    expect(sync.creditApplied[0]).toMatchObject({ paymentId: g.paymentId, chargeId: sync.created[0].id, amount: 300_000, source: "CREDIT_APPLY" });
    expect(await studentBalance(p, g.studentId)).toMatchObject({ debt: 700_000, credit: 0 });
    const es = await earningsOf(g.paymentId);
    expect(es.map((e) => [e.serviceMonth, e.earningMonth, e.amount])).toEqual([[10, 10, 400_000], [11, 10, 120_000]]);
    expect(await p.payment.count({ where: { studentId: g.studentId } })).toBe(1); // yangi to'lov yaratilmagan
  });

  it("I: MAIN 40% + ASSISTANT 10%, 1M → 400k va 100k", async () => {
    const p = db.prisma;
    const { group, teacher } = await mkGroup("I-01", "TeacherI");
    const asst = await p.user.create({ data: { fullName: "AssistantI", email: "asst-i@t.local", passwordHash: "x", role: "TEACHER", branchId: ids.branch } });
    const rule = await createSalaryRule(p, { scope: "ASSIGNMENT", targetId: asst.id, component: "PERCENT", rateBp: 1000, effectiveFrom: monthStart(OCT), actorId: ids.director });
    await assignTeacher(p, { groupId: group.id, teacherId: asst.id, role: "ASSISTANT", effectiveFrom: monthStart(OCT), compensationRuleId: rule.id, actorId: ids.director });
    const s = await mkStudent(group.id, monthStart(OCT), "I-student");
    const r = await pay(s.id, FEE, "2026-10-05T05:00:00Z", "i");
    const es = await earningsOf(r.payment.id);
    expect(es.map((e) => [e.teacherId === teacher.id ? "main" : "asst", e.amount, e.status])).toEqual([["main", 400_000, "POSTED"], ["asst", 100_000, "POSTED"]]);
  });

  it("J: bir oyda ikki MAIN o'qituvchi (split noaniq) → ikkita to'liq komissiya EMAS; ikkalasi NEEDS_REVIEW (AMBIGUOUS_ASSIGNMENT), POSTED = 0", async () => {
    const p = db.prisma;
    const { group } = await mkGroup("J-01", "TeacherJ1");
    const t2 = await p.user.create({ data: { fullName: "TeacherJ2", email: "j2@t.local", passwordHash: "x", role: "TEACHER", branchId: ids.branch } });
    await assignTeacher(p, { groupId: group.id, teacherId: t2.id, role: "MAIN", effectiveFrom: T("2026-10-14T19:00:00Z"), actorId: ids.director }); // 15-okt'dan ikkinchi MAIN (birinchisi tugatilmagan)
    const s = await mkStudent(group.id, monthStart(OCT), "J-student");
    const r = await pay(s.id, FEE, "2026-10-20T05:00:00Z", "j");
    const es = await earningsOf(r.payment.id);
    expect(es).toHaveLength(2);
    expect(es.every((e) => e.status === "NEEDS_REVIEW" && e.reviewReason === "AMBIGUOUS_ASSIGNMENT")).toBe(true);
    expect(es.filter((e) => e.status === "POSTED")).toHaveLength(0);
    expect(es.every((e) => e.settlementPeriodId === null)).toBe(true); // review'gacha davrga tushmaydi
  });

  it("K: butun oy FROZEN o'quvchi → charge 0 / WAIVED — faqat oy tugagach (ochiq FROZEN oy o'rtasida taxmin qilinmaydi); to'lov kredit, earning yo'q", async () => {
    const p = db.prisma;
    const { group } = await mkGroup("K-01", "TeacherK");
    const s = await mkStudent(group.id, monthStart(SEP), "K-student", { eduStatus: "FROZEN" }); // holat tarixi: sentabrdan FROZEN (KNOWN — cutover'dan keyin)
    // Oktabr o'rtasida: oy tugamagan, FROZEN intervali ochiq → charge keyinga qoldiriladi (OPEN ham, WAIVED ham emas)
    const mid = await syncStudentBilling(p, { studentId: s.id, upTo: OCT, actorId: ids.director, now: T("2026-10-02T05:00:00Z") });
    expect(mid.created.find((c) => c.serviceMonth === 10)).toBeUndefined();
    expect(await p.studentCharge.count({ where: { studentId: s.id, serviceMonth: 10 } })).toBe(0);
    const r = await pay(s.id, 500_000, "2026-10-05T05:00:00Z", "k");
    expect(r.allocations).toHaveLength(0);
    expect(r.balance).toMatchObject({ debt: 0, credit: 500_000 });
    expect(await earningsOf(r.payment.id)).toHaveLength(0);
    // Oy tugadi, hali ham FROZEN → oktabr WAIVED (0); kredit saqlanadi
    const done = await syncStudentBilling(p, { studentId: s.id, upTo: OCT, actorId: ids.director, now: T("2026-11-02T05:00:00Z") });
    const oct = done.created.find((c) => c.serviceMonth === 10)!;
    expect(oct).toMatchObject({ status: "WAIVED", finalAmount: 0, originalAmount: FEE });
    expect(JSON.parse(oct.snapshot ?? "{}").frozenFullMonth).toBe(true);
    expect(done.creditApplied).toHaveLength(0);
    expect((await studentBalance(p, s.id))).toMatchObject({ debt: 0, credit: 500_000 });
    // INFERRED (legacy) FROZEN — moliyaviy fakt taxmin qilinmaydi: to'liq charge, snapshot'da frozenInferred belgisi
    const CUTOVER_NOV = "2026-11-01T00:00:00+05:00";
    await p.setting.update({ where: { key: "finance.v2.cutoverAt" }, data: { value: CUTOVER_NOV } });
    try {
      const { group: g2 } = await mkGroup("K-02", "TeacherK2");
      const s2 = await mkStudent(g2.id, monthStart(SEP), "K-legacy-frozen", { eduStatus: "FROZEN" }); // createdAt < cutover → INFERRED
      const legacy = await syncStudentBilling(p, { studentId: s2.id, upTo: OCT, actorId: ids.director, now: T("2026-11-02T05:00:00Z") });
      const octLegacy = legacy.created.find((c) => c.serviceMonth === 10)!;
      expect(octLegacy).toMatchObject({ status: "OPEN", finalAmount: FEE });
      expect(JSON.parse(octLegacy.snapshot ?? "{}")).toMatchObject({ frozenFullMonth: false, frozenInferred: true });
    } finally {
      await p.setting.update({ where: { key: "finance.v2.cutoverAt" }, data: { value: "2026-08-01T00:00:00+05:00" } });
    }
  });

  it("L: PRESENT_RATIO siyosati, dars yo'q → 100% maosh yaratilmaydi; NEEDS_REVIEW / NO_LESSONS_FOUND", async () => {
    const p = db.prisma;
    await createSalaryPolicyVersion(p, { name: "Chilonzor davomat", branchId: ids.branch2, effectiveFrom: monthStart(AUG), attendanceMode: "PRESENT_RATIO", actorId: ids.director });
    const { group } = await mkGroup("L-01", "TeacherL", ids.branch2);
    const s = await mkStudent(group.id, monthStart(OCT), "L-student", { branchId: ids.branch2 });
    const r = await pay(s.id, FEE, "2026-10-05T05:00:00Z", "l");
    const es = await earningsOf(r.payment.id);
    expect(es).toHaveLength(1);
    expect(es[0]).toMatchObject({ status: "NEEDS_REVIEW", reviewReason: "NO_LESSONS_FOUND", settlementPeriodId: null });
    expect(await p.teacherEarning.count({ where: { sourcePaymentId: r.payment.id, status: "POSTED" } })).toBe(0);
  });

  it("M: cutover qo'riqchisi (S1) — legacy xizmat oyi yoki cutover'dan oldingi to'lov krediti avtomatik POSTED bo'lmaydi (NEEDS_REVIEW)", async () => {
    const p = db.prisma;
    const CUTOVER_OCT = "2026-10-01T00:00:00+05:00";
    await p.setting.update({ where: { key: "finance.v2.cutoverAt" }, data: { value: CUTOVER_OCT } });
    try {
      const { group, teacher } = await mkGroup("M-01", "TeacherM");
      const s = await mkStudent(group.id, monthStart(SEP), "M-student");
      // Sentabr (legacy xizmat oyi) charge'iga oktabrdagi to'lov → LEGACY_SERVICE_MONTH (fiksa bilan ikki marta to'lash xavfi — inson qaror qiladi)
      const r1 = await pay(s.id, FEE, "2026-10-10T05:00:00Z", "m1");
      const e1 = await earningsOf(r1.payment.id);
      expect(e1).toHaveLength(1);
      expect(e1[0]).toMatchObject({ teacherId: teacher.id, serviceMonth: 9, earningMonth: 10, amount: 400_000, status: "NEEDS_REVIEW", reviewReason: "LEGACY_SERVICE_MONTH", settlementPeriodId: null });
      expect(JSON.parse(e1[0].snapshot ?? "{}").cutoverAt).toBe(new Date(CUTOVER_OCT).toISOString());
      // Cutover'dan OLDINGI to'lov (sentabr 25, oktabrdan qo'shiladigan o'quvchi — sentabrda charge yo'q) → kredit;
      // oktabr charge'iga qo'llanganda → PRE_CUTOVER_PAYMENT
      const sAdv = await mkStudent(group.id, monthStart(OCT), "M-advance");
      const r2 = await pay(sAdv.id, FEE, "2026-09-25T05:00:00Z", "m2");
      expect(r2.allocations).toHaveLength(0);
      expect(r2.balance.credit).toBe(FEE);
      const sync = await syncStudentBilling(p, { studentId: sAdv.id, upTo: OCT, actorId: ids.director, now: T("2026-10-12T05:00:00Z") });
      expect(sync.creditApplied.map((a) => [a.paymentId, a.amount])).toEqual([[r2.payment.id, FEE]]);
      const e2 = await earningsOf(r2.payment.id);
      expect(e2).toHaveLength(1);
      expect(e2[0]).toMatchObject({ serviceMonth: 10, earningMonth: 9, amount: 400_000, status: "NEEDS_REVIEW", reviewReason: "PRE_CUTOVER_PAYMENT" });
      // Cutover'dan keyingi oddiy to'lov — avvalgidek POSTED
      const s2 = await mkStudent(group.id, monthStart(OCT), "M-student-2");
      const r3 = await pay(s2.id, FEE, "2026-10-15T05:00:00Z", "m3");
      expect((await earningsOf(r3.payment.id))[0]).toMatchObject({ status: "POSTED", reviewReason: null, amount: 400_000 });
    } finally {
      await p.setting.update({ where: { key: "finance.v2.cutoverAt" }, data: { value: "2026-08-01T00:00:00+05:00" } });
    }
  });

  it("backfill billing: narx belgilanmagan guruh → XATO (soxta kredit yo'q); --allow-unpriced bilan o'tkazib yuboriladi", async () => {
    const p = db.prisma;
    const prog = await p.program.create({ data: { name: "Narxsiz kurs" } });
    const g = await p.group.create({ data: { name: "N-01", programId: prog.id, branchId: ids.branch, createdAt: monthStart(AUG) } });
    const s = await mkStudent(g.id, monthStart(SEP), "N-student");
    await expect(backfillBilling(p, { dryRun: true, upTo: OCT, now: T("2026-10-05T05:00:00Z") })).rejects.toThrow(/Narx belgilanmagan/);
    const r = await backfillBilling(p, { dryRun: true, upTo: OCT, now: T("2026-10-05T05:00:00Z"), allowUnpriced: true });
    expect(r.unpricedGroups[g.id]).toBe(2); // sen, okt
    expect(await p.studentCharge.count({ where: { studentId: s.id } })).toBe(0);
  });

  it("pul invariantlari: taqsimot ≤ to'lov, qaytarim ≤ to'lov, payout ≤ gross, balans = ΣIN−ΣOUT, transfer OUT=IN va P&L/cash flow'ga kirmaydi", async () => {
    const p = db.prisma;
    const num = (v: unknown) => Number(v ?? 0);
    const one = async (sql: string) => num(Object.values((await p.$queryRawUnsafe<Record<string, unknown>[]>(sql))[0] ?? {})[0]);
    const over = await p.$queryRawUnsafe<Record<string, unknown>[]>(`select p.id, p.amount, sum(case when a.kind='ALLOCATION' then a.amount else -a.amount end) alloc, group_concat(a.kind || ':' || a.source || ':' || a.amount) rows from Payment p join PaymentAllocation a on a.paymentId=p.id group by p.id having alloc > p.amount`);
    expect(over.map((r) => ({ ...r, alloc: Number(r.alloc) }))).toEqual([]);
    expect(await one(`select count(*) from (select p.id, p.amount, sum(r.amount) ref from Payment p join Refund r on r.originalPaymentId=p.id and r.status='DONE' group by p.id having ref > p.amount)`)).toBe(0);
    expect(await one(`select count(*) from (select c.id, c.finalAmount, sum(case when a.kind='ALLOCATION' then a.amount else -a.amount end) alloc from StudentCharge c join PaymentAllocation a on a.chargeId=c.id group by c.id having alloc > c.finalAmount)`)).toBe(0);
    expect(await one(`select count(*) from SalaryPeriod where paidAmount > max(grossAmount, 0)`)).toBe(0); // manfiy gross (qaytarim) davrida payout yo'q
    // Qaytarim > to'lov rad
    const anyPay = await p.payment.findFirstOrThrow({ where: { amount: FEE, refunds: { none: {} } } });
    await expect(createRefund(p, { paymentId: anyPay.id, amount: FEE + 1, reason: "Ko'p qaytarim", refundedAt: T("2026-10-30T05:00:00Z"), idempotencyKey: key("over-ref") }, director, T("2026-10-30T05:00:00Z"))).rejects.toThrow();
    // Balans = ΣIN − ΣOUT
    const inSum = await one(`select coalesce(sum(amount),0) from FinancialTransaction where accountId='${ids.cash}' and direction='IN'`);
    const outSum = await one(`select coalesce(sum(amount),0) from FinancialTransaction where accountId='${ids.cash}' and direction='OUT'`);
    expect(await accountBalance(p, ids.cash)).toBe(inSum - outSum);
    // Transfer: OUT = IN, P&L va cash flow net o'zgarmaydi
    const range = { from: monthStart(OCT), to: monthStart(NOV) };
    const cfBefore = await cashFlow(p, range);
    const plBefore = await profitAndLoss(p, OCT);
    const expBefore = (await createExpense(p, { name: "Ijara", amount: 200_000, date: T("2026-10-15T05:00:00Z"), method: "CASH", branchId: ids.branch, idempotencyKey: key("exp") }, director, T("2026-10-15T06:00:00Z"))).expense;
    expect(expBefore.amount).toBe(200_000);
    const cfExp = await cashFlow(p, range);
    const plExp = await profitAndLoss(p, OCT);
    const tr = await createTransfer(p, { fromAccountId: ids.cash, toAccountId: ids.bank, amount: 250_000, occurredAt: T("2026-10-16T05:00:00Z"), idempotencyKey: key("tr") }, director, T("2026-10-16T05:00:00Z"));
    const rows = await p.financialTransaction.findMany({ where: { referenceType: "Transfer", referenceId: tr.transfer.id } });
    expect(rows.map((r) => [r.direction, r.amount]).sort()).toEqual([["IN", 250_000], ["OUT", 250_000]]);
    const cfAfter = await cashFlow(p, range);
    const plAfter = await profitAndLoss(p, OCT);
    expect(cfAfter.net).toBe(cfExp.net);
    expect(cfExp.net).toBe(cfBefore.net - 200_000);
    expect(JSON.stringify(plAfter)).toBe(JSON.stringify(plExp));
    expect(plExp.expenses).toBe(plBefore.expenses + 200_000);
    expect(await accountBalance(p, ids.cash) + await accountBalance(p, ids.bank)).toBe(await one(`select coalesce(sum(case when direction='IN' then amount else -amount end),0) from FinancialTransaction where accountId in ('${ids.cash}','${ids.bank}')`));
    const cash = await accountForMethod(p, ids.branch, "CASH");
    expect(cash.id).toBe(ids.cash);
  });
});
