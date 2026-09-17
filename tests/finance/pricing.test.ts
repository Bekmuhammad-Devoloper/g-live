import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ensureDefaultAccounts } from "@/lib/finance/accounts/accounts";
import { ensureMonthlyCharges } from "@/lib/finance/billing/charges";
import { createDiscount } from "@/lib/finance/billing/discounts";
import { DEFAULT_FEE_SETTING_KEY, branchDefaultFeeKey, resolveFee } from "@/lib/finance/billing/fees";
import { acceptPayment } from "@/lib/finance/payments/accept";
import { monthStart, type YearMonth } from "@/lib/finance/period";
import { legacyPreservationInvariant, preserveLegacyPayments } from "@/lib/finance/legacy/preserve";
import { financeReadiness } from "@/lib/finance/readiness";
import { assignTeacher } from "@/lib/finance/salary/assignments";
import { createSalaryRule } from "@/lib/finance/salary/rules";
import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// Narx manbai (source of truth): kelishilgan → guruh → kurs → filial standarti → global standart; topilmasa charge YO'Q,
// to'lov qabul qilinmaydi (MONTHLY_FEE_NOT_CONFIGURED). Go-live readiness: narxsiz o'quvchi = BLOCKER.

const T = (iso: string) => new Date(iso);
const AUG: YearMonth = { year: 2026, month: 8 };
const OCT: YearMonth = { year: 2026, month: 10 };

describe("monthly fee source of truth + readiness", () => {
  let db: TestDb;
  let ids: { branch: string; program: string; group: string; student: string; director: string; teacher: string };
  let director: { userId: string; role: string; branchId: null };

  beforeAll(async () => {
    db = createTestDb("pricing");
    const p = db.prisma;
    const branch = await p.branch.create({ data: { name: "Markaz" } });
    const d = await p.user.create({ data: { fullName: "Direktor", email: "d@t.local", passwordHash: "x", role: "DIRECTOR" } });
    const t = await p.user.create({ data: { fullName: "Akmal", email: "t@t.local", passwordHash: "x", role: "TEACHER", branchId: branch.id } });
    const program = await p.program.create({ data: { name: "Narxsiz kurs" } }); // monthlyFee yo'q
    const group = await p.group.create({ data: { name: "NG-01", programId: program.id, branchId: branch.id, teacherId: t.id, status: "ACTIVE", createdAt: monthStart(AUG) } });
    const student = await p.student.create({ data: { fullName: "Ali", branchId: branch.id, eduStatus: "ACTIVE", createdAt: monthStart(OCT) } });
    await p.groupStudent.create({ data: { groupId: group.id, studentId: student.id, joinedAt: monthStart(OCT) } });
    await ensureDefaultAccounts(p, branch.id, d.id);
    await createSalaryRule(p, { scope: "GLOBAL", component: "PERCENT", rateBp: 4000, effectiveFrom: monthStart(AUG), actorId: d.id });
    await assignTeacher(p, { groupId: group.id, teacherId: t.id, role: "MAIN", effectiveFrom: monthStart(AUG), actorId: d.id });
    ids = { branch: branch.id, program: program.id, group: group.id, student: student.id, director: d.id, teacher: t.id };
    director = { userId: d.id, role: "DIRECTOR", branchId: null };
  });

  afterAll(async () => {
    await db.dispose();
  });

  it("narx yo'q → charge yaratilmaydi (unpriced), to'lov qabul qilinmaydi (fee_not_configured), readiness BLOCKER", async () => {
    const p = db.prisma;
    expect(await resolveFee(p, { studentId: ids.student, groupId: ids.group, branchId: ids.branch, serviceMonth: OCT })).toBeNull();
    const r = await ensureMonthlyCharges(p, { studentId: ids.student, upTo: OCT, now: T("2026-10-05T05:00:00Z") });
    expect(r.created).toHaveLength(0);
    expect(r.unpriced).toEqual([{ studentId: ids.student, groupId: ids.group, month: "2026-10" }]);
    expect(await p.studentCharge.count()).toBe(0);
    await expect(acceptPayment(p, { studentId: ids.student, amount: 100_000, method: "CASH", receivedAt: T("2026-10-05T05:00:00Z"), purpose: "Kurs", idempotencyKey: "price-pay-0001" }, director, T("2026-10-05T05:00:00Z"))).rejects.toMatchObject({ code: "fee_not_configured" });
    expect(await p.payment.count()).toBe(0); // hech narsa yozilmadi (kredit ham emas)
    const ready = await financeReadiness(p, { now: T("2026-10-05T05:00:00Z") });
    expect(ready.ready).toBe(false);
    const unpriced = ready.issues.find((i) => i.code === "UNPRICED_STUDENTS")!;
    expect(unpriced).toMatchObject({ severity: "BLOCKER", count: 1 });
    expect(unpriced.items[0]).toMatchObject({ id: ids.student, href: `/finance/v2/students/${ids.student}` });
    expect(ready.issues.find((i) => i.code === "UNPRICED_GROUPS")).toMatchObject({ severity: "BLOCKER", count: 1 });
  });

  it("ustuvorlik: global standart < filial standarti < kurs < guruh < kelishilgan (umumiy) < kelishilgan (guruhga xos)", async () => {
    const p = db.prisma;
    const fee = () => resolveFee(p, { studentId: ids.student, groupId: ids.group, branchId: ids.branch, serviceMonth: OCT });
    await p.setting.create({ data: { key: DEFAULT_FEE_SETTING_KEY, value: "500000" } });
    expect(await fee()).toMatchObject({ amount: 500_000, source: "default" });
    await p.setting.create({ data: { key: branchDefaultFeeKey(ids.branch), value: "600000" } });
    expect(await fee()).toMatchObject({ amount: 600_000, source: "branchDefault" });
    await p.program.update({ where: { id: ids.program }, data: { monthlyFee: 700_000 } });
    expect(await fee()).toMatchObject({ amount: 700_000, source: "program" });
    await p.group.update({ where: { id: ids.group }, data: { monthlyFee: 800_000 } });
    expect(await fee()).toMatchObject({ amount: 800_000, source: "group", listAmount: 800_000 });
    const general = await createDiscount(p, { studentId: ids.student, type: "AGREED_PRICE", value: 650_000, effectiveFrom: monthStart(OCT), reason: "Kelishuv (umumiy)", actorId: ids.director });
    expect(await fee()).toMatchObject({ amount: 650_000, source: "agreed", listAmount: 800_000, listSource: "group", agreedPriceId: general.id });
    const specific = await createDiscount(p, { studentId: ids.student, groupId: ids.group, type: "AGREED_PRICE", value: 600_000, effectiveFrom: monthStart(OCT), reason: "Kelishuv (guruh)", actorId: ids.director });
    expect(await fee()).toMatchObject({ amount: 600_000, source: "agreed", agreedPriceId: specific.id });
    // Kelishilgan narx: charge original = ro'yxat (800k), chegirma = farq, yakuniy = 600k; oddiy % chegirma ustiga qo'llanmaydi
    await createDiscount(p, { studentId: ids.student, type: "PERCENT", value: 5000, effectiveFrom: monthStart(OCT), reason: "50% (qo'llanmasligi kerak)", actorId: ids.director });
    const r = await ensureMonthlyCharges(p, { studentId: ids.student, upTo: OCT, now: T("2026-10-05T05:00:00Z") });
    expect(r.created).toHaveLength(1);
    expect(r.created[0]).toMatchObject({ originalAmount: 800_000, discountAmount: 200_000, finalAmount: 600_000, status: "OPEN" });
    expect(JSON.parse(r.created[0].snapshot ?? "{}").fee).toMatchObject({ source: "agreed", listAmount: 800_000, agreedPriceId: specific.id });
    // Yangi kelishilgan narx eskisini yopadi (bir doira uchun bittasi)
    await createDiscount(p, { studentId: ids.student, groupId: ids.group, type: "AGREED_PRICE", value: 550_000, effectiveFrom: monthStart({ year: 2026, month: 11 }), reason: "Noyabrdan", actorId: ids.director });
    expect((await p.studentDiscount.findUniqueOrThrow({ where: { id: specific.id } })).effectiveTo?.getTime()).toBe(monthStart({ year: 2026, month: 11 }).getTime());
    // Narx keyin o'zgarsa eski charge o'zgarmaydi (immutable)
    await p.group.update({ where: { id: ids.group }, data: { monthlyFee: 900_000 } });
    const again = await ensureMonthlyCharges(p, { studentId: ids.student, upTo: OCT, now: T("2026-10-06T05:00:00Z") });
    expect(again).toMatchObject({ existing: 1, created: [] });
    expect((await p.studentCharge.findFirstOrThrow({ where: { studentId: ids.student } })).finalAmount).toBe(600_000);
  });

  it("readiness: narx kiritilgach BLOCKER yo'qoladi (READY); qoidasiz o'qituvchi WARNING; migratsiya (db push test) WARNING", async () => {
    const p = db.prisma;
    const ready = await financeReadiness(p, { now: T("2026-10-05T05:00:00Z") });
    expect(ready.issues.find((i) => i.code === "UNPRICED_STUDENTS")).toBeUndefined();
    expect(ready.issues.find((i) => i.code === "MIGRATION_NOT_APPLIED")?.severity).toBe("WARNING");
    expect(ready.blockers).toBe(0);
    expect(ready.ready).toBe(true);
    // MAIN o'qituvchisiz guruh (o'quvchisi bor) → BLOCKER
    const g2 = await p.group.create({ data: { name: "NoTeacher", programId: ids.program, branchId: ids.branch, status: "ACTIVE" } });
    const s2 = await p.student.create({ data: { fullName: "Vali", branchId: ids.branch, eduStatus: "ACTIVE" } });
    await p.groupStudent.create({ data: { groupId: g2.id, studentId: s2.id } });
    const r2 = await financeReadiness(p, { now: T("2026-10-05T05:00:00Z") });
    expect(r2.ready).toBe(false);
    expect(r2.issues.find((i) => i.code === "GROUP_NO_MAIN_TEACHER")).toMatchObject({ severity: "BLOCKER", count: 1 });
    // Yaroqsiz legacy qoida → BLOCKER
    await p.salaryRule.create({ data: { scope: "ALL", amountType: "PERCENT", amount: 250 } });
    const r3 = await financeReadiness(p, { now: T("2026-10-05T05:00:00Z") });
    expect(r3.issues.find((i) => i.code === "INVALID_RULES")).toMatchObject({ severity: "BLOCKER", count: 1 });
  });

  it("legacy real to'lov: cutover'dan oldingi taqsimlanmagan to'lov → readiness BLOCKER (soxta kredit); preserve-legacy → HISTORICAL + NEEDS_REVIEW, kredit emas, ledger 1 marta, summa o'zgarmaydi", async () => {
    const p = db.prisma;
    await p.setting.update({ where: { key: "finance.v2.cutoverAt" }, data: { value: "2026-11-01T00:00:00+05:00" } }); // cutover noyabr → oktabr to'lovi legacy
    try {
      const s2 = await p.student.create({ data: { fullName: "Legacy", branchId: ids.branch, eduStatus: "ACTIVE", createdAt: monthStart(OCT) } }); // guruhsiz → charge yo'q
      const r = await acceptPayment(p, { studentId: s2.id, amount: 250_000, method: "CASH", receivedAt: T("2026-10-20T05:00:00Z"), purpose: "Kurs", idempotencyKey: "legacy-credit-0001" }, director, T("2026-10-20T05:00:00Z"));
      expect(r.balance.credit).toBe(250_000);
      const before = await financeReadiness(p, { now: T("2026-11-05T05:00:00Z") });
      expect(before.issues.find((i) => i.code === "LEGACY_CREDIT")).toMatchObject({ severity: "BLOCKER", count: 1 });
      const dry = await preserveLegacyPayments(p, { dryRun: true });
      expect(dry).toMatchObject({ candidates: 1, legacyTotal: 250_000, preservedTotal: 250_000, markedHistorical: 1, needsReview: 1, lostAmount: 0, duplicateLedger: 0 });
      expect((await p.payment.findUniqueOrThrow({ where: { id: r.payment.id } })).legacyRole).toBeNull(); // dry-run yozmadi
      const real = await preserveLegacyPayments(p, { actorId: ids.director });
      expect(real).toMatchObject({ markedHistorical: 1, reviewsCreated: 1, needsReview: 1, needsReviewAmount: 250_000 });
      const pay = await p.payment.findUniqueOrThrow({ where: { id: r.payment.id } });
      expect(pay).toMatchObject({ legacyRole: "HISTORICAL", amount: 250_000, status: "PAID" }); // summa/holat o'zgarmadi
      expect(await p.financialTransaction.count({ where: { referenceType: "Payment", referenceId: r.payment.id } })).toBe(1); // ledger IN qoladi, bitta
      const review = await p.legacyPaymentReview.findUniqueOrThrow({ where: { paymentId: r.payment.id } });
      expect(review).toMatchObject({ status: "NEEDS_REVIEW", classification: "UNATTRIBUTABLE", amount: 250_000 });
      expect((await financeReadiness(p, { now: T("2026-11-05T05:00:00Z") })).issues.find((i) => i.code === "LEGACY_CREDIT")).toBeUndefined();
      // Kredit emas: o'quvchi balansida kredit 0
      const { studentBalance } = await import("@/lib/finance/billing/balance");
      expect((await studentBalance(p, s2.id)).credit).toBe(0);
      // Invariant + idempotent ikkinchi run
      const inv = await legacyPreservationInvariant(p);
      expect(inv).toMatchObject({ legacyCount: 1, legacyTotal: 250_000, preservedTotal: 250_000, ledgerInCount: 1, ledgerInTotal: 250_000, lostAmount: 0, duplicateLedger: 0, fakeCreditCount: 0, ok: true });
      const again = await preserveLegacyPayments(p, { actorId: ids.director });
      expect(again).toMatchObject({ markedHistorical: 0, reviewsCreated: 0, reviewsExisting: 1, lostAmount: 0 });
      expect(await p.auditLog.count({ where: { entityType: "LegacyPaymentReview" } })).toBe(1);
    } finally {
      await p.setting.update({ where: { key: "finance.v2.cutoverAt" }, data: { value: "2026-08-01T00:00:00+05:00" } });
    }
  });
});
