import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { agingBucket, debtAging, debtorsList, refreshChargeStatus, studentBalance } from "@/lib/finance/billing/balance";
import { adjustCharge, cancelCharge, createManualDebtCharge, ensureMonthlyCharges, monthlyChargeKey, replaceCharge } from "@/lib/finance/billing/charges";
import { createDiscount, endDiscount, resolveDiscount } from "@/lib/finance/billing/discounts";
import { membershipIntervals, statusIntervals, syncStudentHistory } from "@/lib/finance/billing/history";
import { createBillingPolicyVersion, resolveBillingPolicy } from "@/lib/finance/billing/policy";
import { FinanceError } from "@/lib/finance/errors";
import { monthStart } from "@/lib/finance/period";
import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// Phase 3 — billing dvigateli: FULL_MONTH, a'zoliksiz oy yo'q, to'liq oy FROZEN → WAIVED,
// chegirma snapshot, idempotent charge, lineage (cancel/replace/adjust), balans, aging.

const T = (iso: string) => new Date(iso);
const CUTOVER = T("2026-09-30T19:00:00Z"); // 1-okt 00:00 Tashkent
const AUG = { year: 2026, month: 8 };
const SEP = { year: 2026, month: 9 };
const OCT = { year: 2026, month: 10 };
const NOV = { year: 2026, month: 11 };

describe("billing engine (Phase 3)", () => {
  let db: TestDb;
  let ids: { branch: string; program: string; group: string; group2: string; student: string; teacher: string };

  beforeAll(async () => {
    db = createTestDb("billing");
    const p = db.prisma;
    const branch = await p.branch.create({ data: { name: "Markaz" } });
    const teacher = await p.user.create({ data: { fullName: "Ustoz", email: "t@t.local", passwordHash: "x", role: "TEACHER" } });
    const program = await p.program.create({ data: { name: "Nemis A1", monthlyFee: 1_000_000 } });
    const group = await p.group.create({ data: { name: "A1-1", programId: program.id, branchId: branch.id, teacherId: teacher.id } });
    const group2 = await p.group.create({ data: { name: "A1-2", programId: program.id, branchId: branch.id, monthlyFee: 600_000 } });
    const student = await p.student.create({ data: { fullName: "Ali", branchId: branch.id, eduStatus: "ACTIVE", createdAt: T("2026-08-10T05:00:00Z") } });
    await p.groupStudent.create({ data: { groupId: group.id, studentId: student.id, joinedAt: T("2026-08-10T05:00:00Z") } });
    ids = { branch: branch.id, program: program.id, group: group.id, group2: group2.id, student: student.id, teacher: teacher.id };
  });

  afterAll(async () => {
    await db.dispose();
  });

  it("tarix sinxron: a'zolik INFERRED (cutover'dan oldin), holat ACTIVE", async () => {
    await syncStudentHistory(db.prisma, ids.student, { at: T("2026-10-05T05:00:00Z"), cutoverAt: CUTOVER });
    const m = await membershipIntervals(db.prisma, ids.student);
    expect(m).toHaveLength(1);
    expect(m[0].source).toBe("INFERRED");
    expect(m[0].to).toBeNull();
    const s = await statusIntervals(db.prisma, ids.student);
    expect(s.map((x) => x.key)).toEqual(["ACTIVE"]);
    expect(s[0].source).toBe("INFERRED");
  });

  it("billing policy: yozuv yo'q → standart; versiya yaratish oy boshi talab qiladi", async () => {
    expect((await resolveBillingPolicy(db.prisma, ids.branch, SEP)).dueDay).toBe(1);
    await expect(createBillingPolicyVersion(db.prisma, { name: "Standart", effectiveFrom: T("2026-09-15T00:00:00Z") })).rejects.toThrow(FinanceError);
    const v1 = await createBillingPolicyVersion(db.prisma, { name: "Standart", effectiveFrom: monthStart(AUG), dueDay: 5 });
    expect(v1.version).toBe(1);
    const v2 = await createBillingPolicyVersion(db.prisma, { name: "Standart", effectiveFrom: monthStart(OCT), dueDay: 1 });
    expect(v2.version).toBe(2);
    expect((await db.prisma.billingPolicy.findUniqueOrThrow({ where: { id: v1.id } })).effectiveTo?.getTime()).toBe(monthStart(OCT).getTime());
    expect((await resolveBillingPolicy(db.prisma, ids.branch, SEP)).dueDay).toBe(5); // v1 sentabrda amal qiladi
    expect((await resolveBillingPolicy(db.prisma, ids.branch, OCT)).dueDay).toBe(1);
  });

  it("FULL_MONTH: qo'shilgan oy (10-avg) to'liq; avg/sen/okt uchun 3 ta charge; idempotent", async () => {
    const r1 = await ensureMonthlyCharges(db.prisma, { studentId: ids.student, upTo: OCT, cutoverAt: CUTOVER, now: T("2026-10-05T05:00:00Z") });
    expect(r1.created.map((c) => `${c.serviceYear}-${c.serviceMonth}:${c.finalAmount}`)).toEqual(["2026-8:1000000", "2026-9:1000000", "2026-10:1000000"]);
    expect(r1.created[0].chargeKey).toBe(monthlyChargeKey(ids.student, ids.group, AUG));
    expect(r1.created[1].dueDate.getTime()).toBe(T("2026-09-04T19:00:00Z").getTime()); // dueDay 5 (v1), Tashkent 00:00
    expect(r1.created[2].dueDate.getTime()).toBe(monthStart(OCT).getTime()); // dueDay 1 (v2)
    const snap = JSON.parse(r1.created[0].snapshot ?? "{}");
    expect(snap.fee).toMatchObject({ amount: 1_000_000, source: "program", listAmount: 1_000_000, listSource: "program", agreedPriceId: null });
    expect(snap.membership.source).toBe("INFERRED");

    const r2 = await ensureMonthlyCharges(db.prisma, { studentId: ids.student, upTo: OCT, cutoverAt: CUTOVER, now: T("2026-10-05T05:00:00Z") });
    expect(r2.created).toHaveLength(0);
    expect(r2.existing).toBe(3);
    // Parallel chaqiruv — dublikat yo'q
    await Promise.all([1, 2, 3].map(() => ensureMonthlyCharges(db.prisma, { studentId: ids.student, upTo: OCT, cutoverAt: CUTOVER })));
    expect(await db.prisma.studentCharge.count({ where: { studentId: ids.student, kind: "MONTHLY" } })).toBe(3);
  });

  it("chegirma: keyingi oyga ta'sir qiladi, mavjud charge o'zgarmaydi; eng kattasi qo'llanadi", async () => {
    await createDiscount(db.prisma, { studentId: ids.student, type: "PERCENT", value: 2000, effectiveFrom: monthStart(NOV), reason: "Imtiyoz" });
    const small = await createDiscount(db.prisma, { studentId: ids.student, groupId: ids.group, type: "FIXED", value: 50_000, effectiveFrom: monthStart(NOV), reason: "Aksiya" });
    const res = await resolveDiscount(db.prisma, ids.student, ids.group, NOV, 1_000_000);
    expect(res.applied?.amount).toBe(200_000);
    expect(res.candidates).toHaveLength(2);
    const r = await ensureMonthlyCharges(db.prisma, { studentId: ids.student, upTo: NOV, cutoverAt: CUTOVER, now: T("2026-11-03T05:00:00Z") });
    expect(r.created).toHaveLength(1);
    expect(r.created[0].discountAmount).toBe(200_000);
    expect(r.created[0].finalAmount).toBe(800_000);
    // Oktabr charge'i o'zgarmagan
    const oct = await db.prisma.studentCharge.findUniqueOrThrow({ where: { chargeKey: monthlyChargeKey(ids.student, ids.group, OCT) } });
    expect(oct.finalAmount).toBe(1_000_000);
    await endDiscount(db.prisma, small.id, T("2026-11-10T00:00:00Z"));
  });

  it("to'liq oy FROZEN → 0 summali WAIVED charge; qisman muzlatilgan oy — to'liq", async () => {
    const p = db.prisma;
    const s2 = await p.student.create({ data: { fullName: "Muzlatilgan", branchId: ids.branch, eduStatus: "ACTIVE", createdAt: T("2026-07-01T05:00:00Z") } });
    await p.groupStudent.create({ data: { groupId: ids.group2, studentId: s2.id, joinedAt: T("2026-07-01T05:00:00Z") } });
    // Holat tarixi qo'lda (cutover'dan keyingi real oqimda hook yozadi): avg to'liq FROZEN, sen 10-sanadan ACTIVE
    await p.studentStatusHistory.create({ data: { studentId: s2.id, status: "ACTIVE", effectiveFrom: T("2026-07-01T05:00:00Z"), effectiveTo: monthStart(AUG) } });
    await p.studentStatusHistory.create({ data: { studentId: s2.id, status: "FROZEN", effectiveFrom: monthStart(AUG), effectiveTo: T("2026-09-09T19:00:00Z") } });
    await p.studentStatusHistory.create({ data: { studentId: s2.id, status: "ACTIVE", effectiveFrom: T("2026-09-09T19:00:00Z") } });
    const r = await ensureMonthlyCharges(db.prisma, { studentId: s2.id, upTo: SEP, cutoverAt: CUTOVER, now: T("2026-09-20T05:00:00Z") });
    const byMonth = Object.fromEntries(r.created.map((c) => [c.serviceMonth, c]));
    expect(byMonth[7].finalAmount).toBe(600_000); // guruh narxi
    expect(byMonth[8].finalAmount).toBe(0);
    expect(byMonth[8].status).toBe("WAIVED");
    expect(JSON.parse(byMonth[8].snapshot ?? "{}").frozenFullMonth).toBe(true);
    expect(byMonth[9].finalAmount).toBe(600_000);
  });

  it("guruhdan chiqqan oy to'liq, keyingi oy charge yo'q; guruhsiz o'quvchi — hech narsa (S2)", async () => {
    const p = db.prisma;
    const s3 = await p.student.create({ data: { fullName: "Chiqqan", branchId: ids.branch, eduStatus: "ACTIVE", createdAt: T("2026-08-01T05:00:00Z") } });
    await p.groupStudent.create({ data: { groupId: ids.group2, studentId: s3.id, joinedAt: T("2026-08-01T05:00:00Z"), isActive: false, leftAt: T("2026-10-05T05:00:00Z") } });
    const r = await ensureMonthlyCharges(db.prisma, { studentId: s3.id, upTo: NOV, cutoverAt: CUTOVER, now: T("2026-11-03T05:00:00Z") });
    expect(r.created.map((c) => c.serviceMonth)).toEqual([8, 9, 10]);
    const s4 = await p.student.create({ data: { fullName: "Guruhsiz", branchId: ids.branch, eduStatus: "WAITING" } });
    const r4 = await ensureMonthlyCharges(db.prisma, { studentId: s4.id, upTo: NOV, cutoverAt: CUTOVER });
    expect(r4.created).toHaveLength(0);
    expect(r4.skipped).toHaveLength(0);
  });

  it("narx belgilanmagan guruh — charge yozilmaydi, skipped sabab bilan", async () => {
    const p = db.prisma;
    const prog = await p.program.create({ data: { name: "Narxsiz" } });
    const g = await p.group.create({ data: { name: "N-1", programId: prog.id, branchId: ids.branch } });
    const s = await p.student.create({ data: { fullName: "Narxsiz", branchId: ids.branch, eduStatus: "ACTIVE" } });
    await p.groupStudent.create({ data: { groupId: g.id, studentId: s.id, joinedAt: T("2026-10-01T05:00:00Z") } });
    const r = await ensureMonthlyCharges(db.prisma, { studentId: s.id, upTo: OCT, cutoverAt: CUTOVER, now: T("2026-10-20T05:00:00Z") });
    expect(r.created).toHaveLength(0);
    expect(r.skipped[0].reason).toContain("narx");
    // Standart narx sozlansa — keyingi chaqiruvda yoziladi
    await p.setting.create({ data: { key: "finance.defaultMonthlyFee", value: "400000" } });
    const r2 = await ensureMonthlyCharges(db.prisma, { studentId: s.id, upTo: OCT, cutoverAt: CUTOVER, now: T("2026-10-20T05:00:00Z") });
    expect(r2.created[0].finalAmount).toBe(400_000);
    expect(JSON.parse(r2.created[0].snapshot ?? "{}").fee.source).toBe("default");
  });

  it("qo'lda qarz, bekor qilish (taqsimotsiz), almashtirish va tuzatish lineage bilan", async () => {
    const p = db.prisma;
    const manual = await createManualDebtCharge(db.prisma, { studentId: ids.student, amount: 150_000, serviceMonth: SEP, note: "Kitob" });
    expect(manual.kind).toBe("MANUAL_DEBT");
    expect(manual.chargeKey.startsWith("manual:")).toBe(true);
    await expect(cancelCharge(db.prisma, manual.id, "x")).rejects.toThrow(FinanceError); // sabab qisqa
    const cancelled = await cancelCharge(db.prisma, manual.id, "Xato kiritilgan");
    expect(cancelled.status).toBe("CANCELLED");
    await expect(cancelCharge(db.prisma, manual.id, "yana")).rejects.toThrow(/allaqachon/);

    const oct = await p.studentCharge.findUniqueOrThrow({ where: { chargeKey: monthlyChargeKey(ids.student, ids.group, OCT) } });
    const repl = await replaceCharge(db.prisma, { chargeId: oct.id, originalAmount: 1_000_000, discountAmount: 300_000, reason: "Kelishilgan chegirma" });
    expect(repl.replacesChargeId).toBe(oct.id);
    expect(repl.finalAmount).toBe(700_000);
    expect(repl.chargeKey).toBe(`${oct.chargeKey}:adj:${repl.id}`);
    expect((await p.studentCharge.findUniqueOrThrow({ where: { id: oct.id } })).status).toBe("CANCELLED");
    // Idempotentlik saqlanadi: oktabr uchun yana MONTHLY yaratilmaydi (asl kalit band)
    const again = await ensureMonthlyCharges(db.prisma, { studentId: ids.student, upTo: OCT, cutoverAt: CUTOVER });
    expect(again.created).toHaveLength(0);

    const adj = await adjustCharge(db.prisma, { chargeId: repl.id, amount: 50_000, reason: "Qo'shimcha dars" });
    expect(adj.adjustsChargeId).toBe(repl.id);
    expect(adj.kind).toBe("ADJUSTMENT");
    await expect(adjustCharge(db.prisma, { chargeId: oct.id, amount: 1, reason: "bekor qilinganga" })).rejects.toThrow(/Bekor/);
  });

  it("balans: debt = ochiq charge qoldiqlari; credit = V2 to'lovning taqsimlanmagan qismi; aging", async () => {
    const p = db.prisma;
    const b0 = await studentBalance(db.prisma, ids.student);
    // avg 1M + sen 1M + okt(almashtirilgan) 700k + adj 50k + noy 800k = 3 550 000
    expect(b0.debt).toBe(3_550_000);
    expect(b0.credit).toBe(0);

    // V2 to'lov (postedAt) 1.2M: avgustga 1M taqsimlangan, 200k taqsimlanmagan = kredit
    const pay = await p.payment.create({ data: { studentId: ids.student, amount: 1_200_000, method: "CASH", status: "PAID", receivedAt: T("2026-10-10T05:00:00Z"), postedAt: new Date() } });
    const aug = await p.studentCharge.findUniqueOrThrow({ where: { chargeKey: monthlyChargeKey(ids.student, ids.group, AUG) } });
    await p.paymentAllocation.create({ data: { paymentId: pay.id, chargeId: aug.id, amount: 1_000_000, kind: "ALLOCATION", source: "AUTO_FIFO", idempotencyKey: "t:alloc:1" } });
    expect(await refreshChargeStatus(db.prisma, aug.id)).toBe("PAID");
    const b1 = await studentBalance(db.prisma, ids.student);
    expect(b1.debt).toBe(2_550_000);
    expect(b1.credit).toBe(200_000);
    expect(b1.net).toBe(-2_350_000);
    // Legacy (postedAt null) to'lov kreditga kirmaydi
    await p.payment.create({ data: { studentId: ids.student, amount: 5_000_000, method: "CASH", status: "PAID" } });
    expect((await studentBalance(db.prisma, ids.student)).credit).toBe(200_000);

    const debtors = await debtorsList(db.prisma, { branchId: ids.branch });
    expect(debtors.find((d) => d.studentId === ids.student)?.debt).toBe(2_550_000);
    expect(debtors.every((d) => d.debt > 0)).toBe(true);

    const at = T("2026-11-20T05:00:00Z");
    expect(agingBucket(monthStart(NOV), at)).toBe("8-30");
    expect(agingBucket(T("2026-11-19T19:00:00Z"), at)).toBe("current");
    const aging = await debtAging(db.prisma, { branchId: ids.branch, at });
    expect(aging["30+"].amount).toBeGreaterThan(0); // sentabr (due 5-sen) 30+ kun
    expect(Object.values(aging).reduce((a, b) => a + b.amount, 0)).toBe(debtors.reduce((a, d) => a + d.debt, 0));
  });
});

describe("billing backfill (legacy → V2)", () => {
  it("dry-run yozmaydi; real: tarix INFERRED, MONTHLY charge'lar, PENDING → MANUAL_DEBT (legacyRole=DEBT); idempotent", async () => {
    const { backfillBilling } = await import("@/lib/finance/ops/backfill");
    const db = createTestDb("backfill-billing");
    try {
      const p = db.prisma;
      const branch = await p.branch.create({ data: { name: "F" } });
      const prog = await p.program.create({ data: { name: "P", monthlyFee: 500_000 } });
      const g = await p.group.create({ data: { name: "G", programId: prog.id, branchId: branch.id } });
      const s1 = await p.student.create({ data: { fullName: "L1", branchId: branch.id, eduStatus: "ACTIVE", createdAt: T("2026-07-15T05:00:00Z") } });
      await p.groupStudent.create({ data: { groupId: g.id, studentId: s1.id, joinedAt: T("2026-07-15T05:00:00Z") } });
      const pending = await p.payment.create({ data: { studentId: s1.id, amount: 70_000, method: "CASH", status: "PENDING", isManual: true, purpose: "Kitob", createdAt: T("2026-08-02T05:00:00Z") } });
      const s2 = await p.student.create({ data: { fullName: "L2", branchId: branch.id, eduStatus: "WAITING" } }); // guruhsiz

      const dry = await backfillBilling(p, { dryRun: true, upTo: SEP, cutoverAt: CUTOVER, now: T("2026-09-20T05:00:00Z") });
      expect(dry.chargesCreated).toBe(3); // iyul, avg, sen
      expect(dry.manualDebtsCreated).toBe(1);
      expect(await p.studentCharge.count()).toBe(0); // yozilmadi
      expect(await p.groupStudentHistory.count()).toBe(0);

      const real = await backfillBilling(p, { upTo: SEP, cutoverAt: CUTOVER, now: T("2026-09-20T05:00:00Z") });
      expect(real.students).toBe(2);
      expect(real.chargesCreated).toBe(3);
      expect(real.createdAmount).toBe(1_500_000);
      expect(real.manualDebtsCreated).toBe(1);
      expect((await p.payment.findUniqueOrThrow({ where: { id: pending.id } })).legacyRole).toBe("DEBT");
      expect((await p.groupStudentHistory.findFirstOrThrow({ where: { studentId: s1.id } })).source).toBe("INFERRED");
      expect(await p.studentCharge.count({ where: { studentId: s2.id } })).toBe(0);

      const again = await backfillBilling(p, { upTo: SEP, cutoverAt: CUTOVER, now: T("2026-09-20T05:00:00Z") });
      expect(again.chargesCreated).toBe(0);
      expect(again.chargesExisting).toBe(3);
      expect(again.manualDebtsCreated).toBe(0);
      expect(again.manualDebtsExisting).toBe(1);
      const bal = await studentBalance(p, s1.id);
      expect(bal.debt).toBe(1_570_000);
    } finally {
      await db.dispose();
    }
  }, 60_000);
});
