import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ensureDefaultAccounts } from "@/lib/finance/accounts/accounts";
import { studentBalance } from "@/lib/finance/billing/balance";
import { legacyPreservationInvariant, preserveLegacyPayments } from "@/lib/finance/legacy/preserve";
import { allocateHistoricalPayment, leaveLegacyUnresolved, markLegacyAsAdvance, reopenLegacyReview, resolveHistoricalTeacher } from "@/lib/finance/legacy/resolve";
import { classifyLegacyPayment, collectLegacyPaymentEvidence } from "@/lib/finance/legacy/evidence";
import { backfillBilling, backfillPayments } from "@/lib/finance/ops/backfill";
import { monthStart, type YearMonth } from "@/lib/finance/period";
import { financeReadiness } from "@/lib/finance/readiness";
import { createRefund } from "@/lib/finance/refunds/refund";
import { collectionsTotal } from "@/lib/finance/reports/collections";
import { monthRange } from "@/lib/finance/reports/common";
import { studentBalancesReport } from "@/lib/finance/reports/debt";
import { assignTeacher } from "@/lib/finance/salary/assignments";
import { createSalaryRule } from "@/lib/finance/salary/rules";
import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// LEGACY REAL TO'LOVLARNI SAQLASH — FINAL QAROR: cutover'dan oldingi real to'lovlar o'chirilmaydi, summasi o'zgarmaydi,
// soxta kredit bo'lmaydi, soxta qarz yaratilmaydi, ledger'da bir marta, o'qituvchi ulushi faqat aniq davr + foiz bilan.
// Dalil bo'lmasa taxmin qilinmaydi → HISTORICAL + NEEDS_REVIEW; qarorlar inson tomonidan, AuditLog bilan.

const T = (iso: string) => new Date(iso);
const AUG: YearMonth = { year: 2026, month: 8 };
const SEP: YearMonth = { year: 2026, month: 9 };
const OCT: YearMonth = { year: 2026, month: 10 };
const CUTOVER = monthStart(OCT);
const NOW = T("2026-10-05T05:00:00Z");
const LEGACY_TOTAL = 500_000 + 500_000 + 700_000 + 300_000 + 250_000;

describe("legacy real payments preservation", () => {
  let db: TestDb;
  let ids: { branch: string; other: string; g1: string; g2: string; ali: string; vali: string; guli: string; nodir: string; director: string; teacher: string; accountant: string; manager: string; payAli1: string; payAli2: string; payVali: string; payGuli: string; payNodir: string };
  let director: { userId: string; role: string; branchId: null };
  let snapshotBefore: { id: string; amount: number; method: string; status: string; createdAt: number; studentId: string }[];

  beforeAll(async () => {
    db = createTestDb("legacy-preservation");
    const p = db.prisma;
    await p.setting.update({ where: { key: "finance.v2.cutoverAt" }, data: { value: "2026-10-01T00:00:00+05:00" } });
    const branch = await p.branch.create({ data: { name: "Markaz" } });
    const other = await p.branch.create({ data: { name: "Boshqa" } });
    const d = await p.user.create({ data: { fullName: "Direktor", email: "d@lp.local", passwordHash: "x", role: "DIRECTOR" } });
    const t = await p.user.create({ data: { fullName: "Akmal", email: "t@lp.local", passwordHash: "x", role: "TEACHER", branchId: branch.id } });
    const acc = await p.user.create({ data: { fullName: "Buxgalter", email: "a@lp.local", passwordHash: "x", role: "ACCOUNTANT" } });
    const mgr = await p.user.create({ data: { fullName: "Menejer", email: "m@lp.local", passwordHash: "x", role: "MANAGER", branchId: other.id } });
    const priced = await p.program.create({ data: { name: "Nemis A1", monthlyFee: 500_000 } });
    const unpriced = await p.program.create({ data: { name: "Narxsiz" } });
    const g1 = await p.group.create({ data: { name: "A1-01", programId: priced.id, branchId: branch.id, teacherId: t.id, status: "ACTIVE", createdAt: monthStart(AUG) } });
    const g2 = await p.group.create({ data: { name: "N-01", programId: unpriced.id, branchId: branch.id, teacherId: t.id, status: "ACTIVE", createdAt: monthStart(AUG) } });
    await ensureDefaultAccounts(p, branch.id, d.id);
    // Sentabr qoidasi 40%, oktabrdan 45% — tarixiy ulush faqat o'sha davr foizi bilan
    await createSalaryRule(p, { scope: "GLOBAL", component: "PERCENT", rateBp: 4000, effectiveFrom: monthStart(AUG), actorId: d.id });
    await createSalaryRule(p, { scope: "GLOBAL", component: "PERCENT", rateBp: 4500, effectiveFrom: monthStart(OCT), actorId: d.id });
    await assignTeacher(p, { groupId: g1.id, teacherId: t.id, role: "MAIN", effectiveFrom: monthStart(AUG), actorId: d.id });
    await assignTeacher(p, { groupId: g2.id, teacherId: t.id, role: "MAIN", effectiveFrom: monthStart(AUG), actorId: d.id });

    // Ali: narxli guruh a'zosi (avgustdan) — 2 × 500k legacy to'lov → EXACTLY (backfill FIFO)
    const ali = await p.student.create({ data: { fullName: "Ali", branchId: branch.id, eduStatus: "ACTIVE", createdAt: monthStart(AUG) } });
    await p.groupStudent.create({ data: { groupId: g1.id, studentId: ali.id, joinedAt: monthStart(AUG) } });
    const payAli1 = await p.payment.create({ data: { studentId: ali.id, amount: 500_000, method: "CASH", status: "PAID", isManual: true, purpose: "Avgust", createdAt: T("2026-08-05T05:00:00Z") } });
    const payAli2 = await p.payment.create({ data: { studentId: ali.id, amount: 500_000, method: "CLICK", status: "PAID", isManual: true, createdAt: T("2026-09-03T05:00:00Z") } });
    // Vali: narxsiz guruh a'zosi — 700k "sentabr" → PARTIALLY (a'zolik bor, narx yo'q)
    const vali = await p.student.create({ data: { fullName: "Vali", branchId: branch.id, eduStatus: "ACTIVE", createdAt: monthStart(AUG) } });
    await p.groupStudent.create({ data: { groupId: g2.id, studentId: vali.id, joinedAt: monthStart(AUG) } });
    const payVali = await p.payment.create({ data: { studentId: vali.id, amount: 700_000, method: "CASH", status: "PAID", isManual: true, purpose: "Sentabr oyi uchun", docNumber: "CHK-77", createdAt: T("2026-09-10T05:00:00Z") } });
    // Guli: guruhi o'chirilgan (faqat AuditLog izi) — 300k → PARTIALLY (LOW)
    const guli = await p.student.create({ data: { fullName: "Guli", branchId: branch.id, eduStatus: "ACTIVE", createdAt: monthStart(AUG) } });
    await p.auditLog.create({ data: { action: "CREATE", entityType: "Student", entityId: guli.id, newValue: JSON.stringify({ fullName: "Guli", groupId: "gdel-1" }), createdAt: monthStart(AUG) } });
    await p.auditLog.create({ data: { action: "DELETE", entityType: "Group", entityId: "gdel-1", oldValue: JSON.stringify({ name: "Eski-Guruh" }), createdAt: T("2026-09-16T05:00:00Z") } });
    const payGuli = await p.payment.create({ data: { studentId: guli.id, amount: 300_000, method: "CARD", status: "PAID", isManual: true, createdAt: T("2026-09-15T05:00:00Z") } });
    // Nodir: hech qanday dalil yo'q — 250k → UNATTRIBUTABLE
    const nodir = await p.student.create({ data: { fullName: "Nodir", branchId: branch.id, eduStatus: "LEFT", createdAt: monthStart(AUG) } });
    const payNodir = await p.payment.create({ data: { studentId: nodir.id, amount: 250_000, method: "CASH", status: "PAID", isManual: true, createdAt: T("2026-08-20T05:00:00Z") } });
    // Shovqin: bekor qilingan va cutover'dan keyingi to'lov — legacy hisobiga kirmaydi
    await p.payment.create({ data: { studentId: nodir.id, amount: 999_999, method: "CASH", status: "CANCELLED", isManual: true, createdAt: T("2026-08-21T05:00:00Z") } });

    ids = { branch: branch.id, other: other.id, g1: g1.id, g2: g2.id, ali: ali.id, vali: vali.id, guli: guli.id, nodir: nodir.id, director: d.id, teacher: t.id, accountant: acc.id, manager: mgr.id, payAli1: payAli1.id, payAli2: payAli2.id, payVali: payVali.id, payGuli: payGuli.id, payNodir: payNodir.id };
    director = { userId: d.id, role: "DIRECTOR", branchId: null };
    snapshotBefore = (await p.payment.findMany({ where: { status: "PAID" }, orderBy: { createdAt: "asc" } })).map((x) => ({ id: x.id, amount: x.amount, method: x.method, status: x.status, createdAt: x.createdAt.getTime(), studentId: x.studentId }));
  });

  afterAll(async () => {
    await db.dispose();
  });

  it("read-only audit: dalil dossyesi va konservativ klassifikatsiya (taxmin yo'q)", async () => {
    const p = db.prisma;
    const c = async (id: string) => classifyLegacyPayment(await collectLegacyPaymentEvidence(p, id));
    expect((await c(ids.payAli1)).kind).toBe("EXACTLY_ATTRIBUTABLE"); // a'zolik + kurs narxi → deterministik
    const vali = await c(ids.payVali);
    expect(vali).toMatchObject({ kind: "PARTIALLY_ATTRIBUTABLE", confidence: "MEDIUM", suggestedServiceMonth: "2026-09" }); // "Sentabr" matndan
    const guli = await collectLegacyPaymentEvidence(p, ids.payGuli);
    expect(guli.groupEvidence).toEqual([expect.objectContaining({ groupId: "gdel-1", groupName: "Eski-Guruh", deleted: true, source: "AuditLog:Student.CREATE" })]);
    expect(classifyLegacyPayment(guli)).toMatchObject({ kind: "PARTIALLY_ATTRIBUTABLE", confidence: "LOW" });
    expect((await c(ids.payNodir)).kind).toBe("UNATTRIBUTABLE");
    expect(await p.auditLog.count({ where: { entityType: "LegacyPaymentReview" } })).toBe(0); // audit hech narsa yozmadi
    expect(await p.financialTransaction.count()).toBe(0);
  });

  it("backfill + preserve: 5 real to'lov saqlanadi (summa/sana/usul o'zgarmaydi), ledger IN bittadan, soxta kredit = 0, soxta qarz = 0, earning = 0", async () => {
    const p = db.prisma;
    const billing = await backfillBilling(p, { upTo: OCT, cutoverAt: CUTOVER, now: NOW, allowUnpriced: true });
    expect(billing.unpricedGroups[ids.g2]).toBeGreaterThan(0); // Vali guruhi narxsiz — charge yo'q (soxta qarz emas)
    const pays = await backfillPayments(p, { upTo: OCT, cutoverAt: CUTOVER, now: NOW });
    expect(pays.paidPosted).toBe(5);
    expect(pays.paidAmount).toBe(LEGACY_TOTAL);
    // preserve — dry-run avval (yozmaydi)
    const dry = await preserveLegacyPayments(p, { dryRun: true, actorId: ids.director });
    expect(dry).toMatchObject({ candidates: 5, legacyTotal: LEGACY_TOTAL, preservedTotal: LEGACY_TOTAL, markedHistorical: 3, lostAmount: 0, duplicateLedger: 0, byClassification: { EXACTLY_ATTRIBUTABLE: 2, PARTIALLY_ATTRIBUTABLE: 2, UNATTRIBUTABLE: 1 } });
    expect(await p.legacyPaymentReview.count()).toBe(0);
    const real = await preserveLegacyPayments(p, { actorId: ids.director });
    expect(real).toMatchObject({ candidates: 5, reviewsCreated: 5, autoResolvedAllocated: 2, markedHistorical: 3, needsReview: 3, needsReviewAmount: 700_000 + 300_000 + 250_000, lostAmount: 0, duplicateLedger: 0 });

    // 1) To'lov qatorlari: summa/usul/holat/yaratilgan sana AYNAN; DELETE yo'q
    const after = (await p.payment.findMany({ where: { status: "PAID" }, orderBy: { createdAt: "asc" } })).map((x) => ({ id: x.id, amount: x.amount, method: x.method, status: x.status, createdAt: x.createdAt.getTime(), studentId: x.studentId }));
    expect(after).toEqual(snapshotBefore);
    // 2) Ledger IN — har to'lov uchun aynan bitta, jami = legacy jami
    const ledger = await p.financialTransaction.groupBy({ by: ["referenceId"], where: { referenceType: "Payment", direction: "IN" }, _count: { _all: true }, _sum: { amount: true } });
    expect(ledger).toHaveLength(5);
    expect(ledger.every((l) => l._count._all === 1)).toBe(true);
    expect(ledger.reduce((s, l) => s + (l._sum.amount ?? 0), 0)).toBe(LEGACY_TOTAL);
    // 3) EXACT: Ali to'liq taqsimlangan (avgust + sentabr), legacyRole null, kredit 0, review RESOLVED/ALLOCATED
    const ali = await studentBalance(p, ids.ali);
    expect(ali.credit).toBe(0);
    expect(ali.debt).toBe(500_000); // oktabr (cutover'dan keyingi joriy oy) — haqiqiy joriy hisob, tarixiy emas
    for (const id of [ids.payAli1, ids.payAli2]) {
      expect(await p.legacyPaymentReview.findUniqueOrThrow({ where: { paymentId: id } })).toMatchObject({ classification: "EXACTLY_ATTRIBUTABLE", status: "RESOLVED", resolution: "ALLOCATED", amount: 500_000 });
      expect((await p.payment.findUniqueOrThrow({ where: { id } })).legacyRole).toBeNull();
    }
    const aliAllocs = await p.paymentAllocation.findMany({ where: { paymentId: { in: [ids.payAli1, ids.payAli2] } }, include: { charge: true } });
    expect(aliAllocs.map((a) => `${a.charge.serviceMonth}:${a.amount}:${a.source}`).sort()).toEqual(["8:500000:BACKFILL", "9:500000:BACKFILL"]);
    // 4) Noma'lum → HISTORICAL + NEEDS_REVIEW; kredit EMAS; qarz EMAS
    for (const [id, sid, cls] of [[ids.payVali, ids.vali, "PARTIALLY_ATTRIBUTABLE"], [ids.payGuli, ids.guli, "PARTIALLY_ATTRIBUTABLE"], [ids.payNodir, ids.nodir, "UNATTRIBUTABLE"]] as const) {
      expect((await p.payment.findUniqueOrThrow({ where: { id } })).legacyRole).toBe("HISTORICAL");
      expect(await p.legacyPaymentReview.findUniqueOrThrow({ where: { paymentId: id } })).toMatchObject({ classification: cls, status: "NEEDS_REVIEW", resolution: null });
      expect(await studentBalance(p, sid)).toMatchObject({ credit: 0, debt: 0 });
      expect(await p.studentCharge.count({ where: { studentId: sid } })).toBe(0);
    }
    // 5) O'qituvchi ulushi taxmin bilan YARATILMAYDI
    expect(await p.teacherEarning.count()).toBe(0);
    // 6) Har review uchun audit (actor + sabab)
    expect(await p.auditLog.count({ where: { entityType: "LegacyPaymentReview", action: "CREATE", actorId: ids.director } })).toBe(5);
    expect(await p.auditLog.count({ where: { entityType: "Payment", action: "UPDATE", newValue: { contains: "HISTORICAL" } } })).toBe(3);
    // 7) Buxgalteriya invarianti
    const inv = await legacyPreservationInvariant(p);
    expect(inv).toMatchObject({ legacyCount: 5, legacyTotal: LEGACY_TOTAL, preservedTotal: LEGACY_TOTAL, ledgerInCount: 5, ledgerInTotal: LEGACY_TOTAL, unposted: 0, duplicateLedger: 0, lostAmount: 0, fakeCreditCount: 0, fakeCreditAmount: 0, historical: 3, historicalUnallocated: 1_250_000, ok: true });
    expect(inv.reviews).toEqual({ needsReview: 3, resolvedAllocated: 2, resolvedAdvance: 0, unresolved: 0 });
  }, 60_000);

  it("idempotent: ikkinchi backfill + preserve hech narsani o'zgartirmaydi (dublikat ledger/taqsimot/review = 0)", async () => {
    const p = db.prisma;
    const before = { ledger: await p.financialTransaction.count(), alloc: await p.paymentAllocation.count(), reviews: await p.legacyPaymentReview.count(), charges: await p.studentCharge.count(), audit: await p.auditLog.count(), hist: await p.payment.count({ where: { legacyRole: "HISTORICAL" } }) };
    await backfillBilling(p, { upTo: OCT, cutoverAt: CUTOVER, now: NOW, allowUnpriced: true });
    const pays = await backfillPayments(p, { upTo: OCT, cutoverAt: CUTOVER, now: NOW });
    expect(pays).toMatchObject({ paidPosted: 0, paidExisting: 5, allocationsCreated: 0 });
    const again = await preserveLegacyPayments(p, { actorId: ids.director });
    expect(again).toMatchObject({ candidates: 5, reviewsCreated: 0, reviewsExisting: 5, markedHistorical: 0, lostAmount: 0, duplicateLedger: 0, preservedTotal: LEGACY_TOTAL });
    expect({ ledger: await p.financialTransaction.count(), alloc: await p.paymentAllocation.count(), reviews: await p.legacyPaymentReview.count(), charges: await p.studentCharge.count(), audit: await p.auditLog.count(), hist: await p.payment.count({ where: { legacyRole: "HISTORICAL" } }) }).toEqual(before);
    expect((await legacyPreservationInvariant(p)).ok).toBe(true);
  }, 60_000);

  it("hisobotlar: yig'im (kassa) tarixiy to'lovni BIR marta ko'rsatadi; balans/kredit hisobotida tarixiy pul kredit emas; readiness bloker emas", async () => {
    const p = db.prisma;
    const sep = await collectionsTotal(p, monthRange(SEP));
    expect(sep).toEqual({ amount: 500_000 + 700_000 + 300_000, count: 3 });
    const aug = await collectionsTotal(p, monthRange(AUG));
    expect(aug).toEqual({ amount: 500_000 + 250_000, count: 2 });
    const balances = await studentBalancesReport(p, { onlyNonZero: true });
    expect(balances.filter((b) => b.credit > 0)).toEqual([]);
    const ready = await financeReadiness(p, { now: NOW });
    expect(ready.issues.find((i) => i.code === "LEGACY_CREDIT")).toBeUndefined();
    expect(ready.issues.find((i) => i.code === "LEGACY_PRESERVATION")).toBeUndefined();
    expect(ready.issues.find((i) => i.code === "LEGACY_HISTORICAL_REVIEW")).toMatchObject({ severity: "WARNING", count: 3 });
  });

  it("qo'lda qaror: tarixiy hisobga bog'lash (Vali, sentabr, dalil bilan) → HISTORICAL charge + taqsimot; o'qituvchi ulushi faqat aniq 40% (sentabr) bilan, NEEDS_REVIEW; idempotent", async () => {
    const p = db.prisma;
    await expect(allocateHistoricalPayment(p, { paymentId: ids.payVali, amount: 700_000, newCharge: { serviceMonth: SEP, amount: 700_000, groupId: ids.g2 }, reason: "ok" }, director)).rejects.toMatchObject({ code: "validation" }); // sabab qisqa
    await expect(allocateHistoricalPayment(p, { paymentId: ids.payVali, amount: 800_000, newCharge: { serviceMonth: SEP, amount: 800_000 }, reason: "CHK-77 sentabr" }, director)).rejects.toMatchObject({ code: "insufficient" }); // summadan ko'p
    const r = await allocateHistoricalPayment(p, { paymentId: ids.payVali, amount: 700_000, newCharge: { serviceMonth: SEP, amount: 700_000, groupId: ids.g2, note: "CHK-77" }, reason: "CHK-77 chek: 'Sentabr oyi uchun', N-01 guruhi a'zosi" }, director);
    expect(r.resolved).toBe(true);
    expect(r.charge).toMatchObject({ kind: "HISTORICAL", serviceYear: 2026, serviceMonth: 9, finalAmount: 700_000, status: "PAID", groupId: ids.g2 });
    expect(r.allocation).toMatchObject({ amount: 700_000, source: "MANUAL", kind: "ALLOCATION" });
    expect(await p.legacyPaymentReview.findUniqueOrThrow({ where: { paymentId: ids.payVali } })).toMatchObject({ status: "RESOLVED", resolution: "ALLOCATED", resolvedById: ids.director });
    const vali = await p.payment.findUniqueOrThrow({ where: { id: ids.payVali } });
    expect(vali).toMatchObject({ amount: 700_000, legacyRole: "HISTORICAL", status: "PAID" }); // to'lov o'zgarmadi
    expect(await studentBalance(p, ids.vali)).toMatchObject({ credit: 0, debt: 0 });
    expect(await p.auditLog.count({ where: { entityType: "LegacyPaymentReview", entityId: ids.payVali, action: "ALLOCATE" } })).toBe(1);
    // O'qituvchi ulushi: avtomatik emas; aniq o'qituvchi + aniq foiz (sentabr 40%, oktabr 45% EMAS)
    expect(await p.teacherEarning.count()).toBe(0);
    await expect(resolveHistoricalTeacher(p, { allocationId: r.allocation.id, teacherId: ids.director, rateBp: 4000, reason: "N-01 MAIN sentabr" }, director)).rejects.toMatchObject({ code: "validation" }); // o'qituvchi emas
    const e = await resolveHistoricalTeacher(p, { allocationId: r.allocation.id, teacherId: ids.teacher, rateBp: 4000, reason: "N-01 MAIN o'qituvchi, sentabr qoidasi 40%" }, director);
    expect(e).toMatchObject({ type: "PAYMENT_COMMISSION", status: "NEEDS_REVIEW", reviewReason: "HISTORICAL_RECONSTRUCTION", rateBp: 4000, amount: 280_000, serviceYear: 2026, serviceMonth: 9, earningYear: 2026, earningMonth: 9, teacherId: ids.teacher, allocationId: r.allocation.id });
    const e2 = await resolveHistoricalTeacher(p, { allocationId: r.allocation.id, teacherId: ids.teacher, rateBp: 4500, reason: "takror" }, director);
    expect(e2.id).toBe(e.id); // idempotent — ikkinchi chaqiruv yangi ulush yaratmaydi (45% ham qo'llanmaydi)
    expect(await p.teacherEarning.count()).toBe(1);
    expect((await legacyPreservationInvariant(p)).ok).toBe(true);
  });

  it("avans faqat aniq dalil bilan (sabab ≥ 10): Guli → kredit 300k (dalilli); qayta ochish → yana HISTORICAL; Nodir → hal qilinmagan", async () => {
    const p = db.prisma;
    await expect(markLegacyAsAdvance(p, { paymentId: ids.payGuli, reason: "avans" }, director)).rejects.toMatchObject({ code: "validation" });
    expect((await p.payment.findUniqueOrThrow({ where: { id: ids.payGuli } })).legacyRole).toBe("HISTORICAL");
    await markLegacyAsAdvance(p, { paymentId: ids.payGuli, reason: "Ota-ona bilan kelishuv: 2026-09-15 to'lov keyingi oy uchun avans (qo'ng'iroq yozuvi №12)" }, director);
    expect(await p.payment.findUniqueOrThrow({ where: { id: ids.payGuli } })).toMatchObject({ legacyRole: null, amount: 300_000 });
    expect((await studentBalance(p, ids.guli)).credit).toBe(300_000); // endi dalilli avans — V2 krediti
    const inv = await legacyPreservationInvariant(p);
    expect(inv).toMatchObject({ fakeCreditCount: 0, lostAmount: 0, duplicateLedger: 0, ok: true });
    expect(inv.reviews.resolvedAdvance).toBe(1);
    expect((await financeReadiness(p, { now: NOW })).issues.find((i) => i.code === "LEGACY_CREDIT")).toBeUndefined();
    await reopenLegacyReview(p, { paymentId: ids.payGuli, reason: "Avans qarori tasdiqlanmadi" }, director);
    expect((await p.payment.findUniqueOrThrow({ where: { id: ids.payGuli } })).legacyRole).toBe("HISTORICAL");
    expect((await studentBalance(p, ids.guli)).credit).toBe(0);
    await leaveLegacyUnresolved(p, { paymentId: ids.payNodir, reason: "O'quvchi ketgan, hujjat yo'q" }, director);
    expect(await p.legacyPaymentReview.findUniqueOrThrow({ where: { paymentId: ids.payNodir } })).toMatchObject({ status: "NEEDS_REVIEW", resolution: "UNRESOLVED" });
    expect(await p.auditLog.count({ where: { entityType: "LegacyPaymentReview", entityId: { in: [ids.payGuli, ids.payNodir] }, action: { in: ["UPDATE", "REOPEN"] } } })).toBe(3);
    expect(await p.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID", id: { in: [ids.payAli1, ids.payAli2, ids.payVali, ids.payGuli, ids.payNodir] } } })).toMatchObject({ _sum: { amount: LEGACY_TOTAL } });
  });

  it("himoya: HISTORICAL to'lov qaytarilmaydi (avval qaror); RBAC — boshqa filial MANAGER va ACCOUNTANT (SALARY_APPROVE yo'q) rad etiladi", async () => {
    const p = db.prisma;
    await expect(createRefund(p, { paymentId: ids.payNodir, amount: 100_000, reason: "test", refundedAt: NOW, idempotencyKey: "hist-refund-0001" }, director, NOW)).rejects.toMatchObject({ code: "state" });
    expect(await p.refund.count()).toBe(0);
    const manager = { userId: ids.manager, role: "MANAGER", branchId: ids.other };
    await expect(allocateHistoricalPayment(p, { paymentId: ids.payNodir, amount: 250_000, newCharge: { serviceMonth: AUG, amount: 250_000 }, reason: "boshqa filial" }, manager)).rejects.toMatchObject({ code: "forbidden" });
    const accountant = { userId: ids.accountant, role: "ACCOUNTANT", branchId: null };
    const alloc = await p.paymentAllocation.findFirstOrThrow({ where: { paymentId: ids.payVali } });
    await expect(resolveHistoricalTeacher(p, { allocationId: alloc.id, teacherId: ids.teacher, rateBp: 4000, reason: "buxgalter" }, accountant)).rejects.toMatchObject({ code: "forbidden" });
    expect(await p.studentCharge.count({ where: { studentId: ids.nodir } })).toBe(0);
    expect((await legacyPreservationInvariant(p)).ok).toBe(true);
  });
});
