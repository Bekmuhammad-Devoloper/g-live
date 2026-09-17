// Finance V2 — LEGACY REAL TO'LOVLARNI SAQLASH (preservation). FINAL QAROR: cutover'dan oldingi real to'lovlar
// o'chirilmaydi, summasi o'zgarmaydi, "soxta kredit" bo'lmaydi, yashirilmaydi; lineage va audit to'liq.
//
// Model:
//   · Payment qatori — source of truth (id, summa, sana, usul o'zgarmaydi). Ledger IN — aynan shu to'lovga reference
//     (idempotent: `Payment:<id>:IN:0`) — ikki marta hisoblanmaydi.
//   · Backfill FIFO taqsimoti (a'zolik + narx bo'lsa) — deterministik tiklash → EXACTLY_ATTRIBUTABLE.
//   · Taqsimlanmagan qismi bor to'lov → legacyRole = "HISTORICAL": V2 KREDITI EMAS (balans/kredit hisoblarida
//     ishtirok etmaydi), yig'im/kassa hisobotlarida o'z oyida BIR marta ko'rinadi, LegacyPaymentReview (NEEDS_REVIEW)
//     bilan inson qaroriga qoldiriladi (tarixiy hisobga bog'lash / avans deb tasdiqlash / hal qilinmagan).
//   · Hech qanday TeacherEarning taxmin bilan yaratilmaydi.

import type { PrismaClient } from "@prisma/client";
import { financeAudit } from "../audit";
import { paymentAvailability } from "../billing/balance";
import { cutoverAtFrom } from "../cutover";
import { withFinanceTx, type FinanceDb } from "../db";
import { classifyLegacyPayment, collectLegacyPaymentEvidence, type LegacyClassification } from "./evidence";

export const LEGACY_HISTORICAL_ROLE = "HISTORICAL";

export interface PreserveReport {
  candidates: number;
  /** cutover'dan oldingi real to'lovlar jami (o'zgarmasligi shart) */
  legacyTotal: number;
  preservedTotal: number;
  markedHistorical: number;
  reviewsCreated: number;
  reviewsExisting: number;
  autoResolvedAllocated: number;
  byClassification: Record<LegacyClassification, number>;
  needsReview: number;
  needsReviewAmount: number;
  lostAmount: number;
  duplicateLedger: number;
  dryRun: boolean;
}

/** Cutover'dan oldingi real (PAID) to'lovlar — V2'ga kiritilgan (postedAt) yoki hali kiritilmagan */
export async function legacyPaymentsBefore(db: FinanceDb, cutoverAt: Date) {
  return db.payment.findMany({
    where: { status: "PAID", OR: [{ legacyRole: null }, { legacyRole: LEGACY_HISTORICAL_ROLE }], AND: [{ OR: [{ receivedAt: { lt: cutoverAt } }, { receivedAt: null, createdAt: { lt: cutoverAt } }] }] },
    orderBy: [{ createdAt: "asc" }],
  });
}

/** Saqlash bosqichi — backfill `payments` dan KEYIN (ledger IN va deterministik FIFO allaqachon bajarilgan) */
export async function preserveLegacyPayments(client: PrismaClient, o: { cutoverAt?: Date; actorId?: string | null; dryRun?: boolean } = {}): Promise<PreserveReport> {
  const cutoverAt = o.cutoverAt ?? (await cutoverAtFrom(client));
  const payments = await legacyPaymentsBefore(client, cutoverAt);
  const report: PreserveReport = { candidates: payments.length, legacyTotal: payments.reduce((a, p) => a + p.amount, 0), preservedTotal: 0, markedHistorical: 0, reviewsCreated: 0, reviewsExisting: 0, autoResolvedAllocated: 0, byClassification: { EXACTLY_ATTRIBUTABLE: 0, PARTIALLY_ATTRIBUTABLE: 0, UNATTRIBUTABLE: 0 }, needsReview: 0, needsReviewAmount: 0, lostAmount: 0, duplicateLedger: 0, dryRun: !!o.dryRun };
  const avail = await paymentAvailability(client, payments.map((p) => p.id));

  const run = async (tx: FinanceDb) => {
    for (const p of payments) {
      const ev = await collectLegacyPaymentEvidence(tx, p.id);
      const cls = classifyLegacyPayment(ev);
      report.byClassification[cls.kind]++;
      const unallocated = avail.get(p.id)?.unallocated ?? p.amount;
      const fullyAllocated = unallocated === 0 && (avail.get(p.id)?.allocated ?? 0) > 0;
      const existing = await tx.legacyPaymentReview.findUnique({ where: { paymentId: p.id } });
      if (existing) {
        report.reviewsExisting++;
        if (existing.amount !== p.amount) report.lostAmount += Math.abs(existing.amount - p.amount); // summa o'zgargan bo'lsa — invariant buzilgan
      } else if (!o.dryRun) {
        await tx.legacyPaymentReview.create({
          data: {
            paymentId: p.id, studentId: p.studentId, amount: p.amount, receivedAt: p.receivedAt ?? p.createdAt,
            classification: cls.kind, confidence: cls.confidence, status: fullyAllocated ? "RESOLVED" : "NEEDS_REVIEW", resolution: fullyAllocated ? "ALLOCATED" : null,
            evidence: JSON.stringify(ev), reasons: JSON.stringify(cls.reasons), suggestedMonth: cls.suggestedServiceMonth,
            reason: fullyAllocated ? "Backfill: a'zolik + narx bo'yicha deterministik FIFO taqsimot (HISTORICAL_RECONSTRUCTION)" : null,
            resolvedAt: fullyAllocated ? new Date() : null,
          },
        });
        report.reviewsCreated++;
        if (fullyAllocated) report.autoResolvedAllocated++;
        await financeAudit(tx, { actorId: o.actorId ?? null, action: "CREATE", entityType: "LegacyPaymentReview", entityId: p.id, newValue: { classification: cls.kind, confidence: cls.confidence, status: fullyAllocated ? "RESOLVED" : "NEEDS_REVIEW", amount: p.amount, unallocated }, reason: cls.reasons.join("; ").slice(0, 900) });
      } else {
        report.reviewsCreated++;
        if (fullyAllocated) report.autoResolvedAllocated++;
      }
      // Taqsimlanmagan qismi bor (va avans deb tasdiqlanmagan) → HISTORICAL: V2 krediti emas
      const resolvedAdvance = existing?.resolution === "ADVANCE";
      if (unallocated > 0 && !resolvedAdvance && p.legacyRole !== LEGACY_HISTORICAL_ROLE) {
        if (!o.dryRun) {
          await tx.payment.update({ where: { id: p.id }, data: { legacyRole: LEGACY_HISTORICAL_ROLE } });
          await financeAudit(tx, { actorId: o.actorId ?? null, action: "UPDATE", entityType: "Payment", entityId: p.id, oldValue: { legacyRole: p.legacyRole }, newValue: { legacyRole: LEGACY_HISTORICAL_ROLE, unallocated }, reason: "Legacy real to'lov — taqsimlanmagan qismi V2 krediti emas; ko'rib chiqish talab qilinadi (summa/sana o'zgarmaydi)" });
        }
        report.markedHistorical++;
      }
      if (unallocated > 0 && !resolvedAdvance) { report.needsReview++; report.needsReviewAmount += unallocated; }
      // Saqlangan summa: to'lov qatori o'zgarmagan (summa) va ledger IN aynan bitta
      const ledger = await tx.financialTransaction.count({ where: { referenceType: "Payment", referenceId: p.id, direction: "IN" } });
      if (ledger > 1) report.duplicateLedger += ledger - 1;
      report.preservedTotal += p.amount;
    }
  };
  await withFinanceTx(client, run, { attempts: 1, timeout: 300_000 });
  if (report.preservedTotal !== report.legacyTotal) report.lostAmount += Math.abs(report.legacyTotal - report.preservedTotal);
  return report;
}

export interface PreservationInvariant {
  cutoverAt: string;
  legacyCount: number;
  legacyTotal: number;
  preservedCount: number;
  preservedTotal: number;
  ledgerInCount: number;
  ledgerInTotal: number;
  /** postedAt bo'lmagan (hali ledger'ga yozilmagan) legacy to'lovlar */
  unposted: number;
  duplicateLedger: number;
  lostAmount: number;
  /** legacyRole null + taqsimlanmagan > 0 (V2 krediti bo'lib turgan legacy pul — bo'lmasligi kerak) */
  fakeCreditCount: number;
  fakeCreditAmount: number;
  historical: number;
  historicalUnallocated: number;
  reviews: { needsReview: number; resolvedAllocated: number; resolvedAdvance: number; unresolved: number };
  ok: boolean;
}

/** Buxgalteriya invarianti: legacy real to'lovlar jami = saqlangan jami; ledger IN har biri uchun ≤ 1; yo'qolgan = 0; soxta kredit = 0 */
export async function legacyPreservationInvariant(db: FinanceDb, cutoverAt?: Date): Promise<PreservationInvariant> {
  const at = cutoverAt ?? (await cutoverAtFrom(db));
  const payments = await legacyPaymentsBefore(db, at);
  const ids = payments.map((p) => p.id);
  const avail = await paymentAvailability(db, ids);
  const reviews = await db.legacyPaymentReview.findMany({ where: { paymentId: { in: ids } } });
  const ledgerRows = ids.length ? await db.financialTransaction.groupBy({ by: ["referenceId"], where: { referenceType: "Payment", referenceId: { in: ids }, direction: "IN", type: "STUDENT_PAYMENT" }, _count: { _all: true }, _sum: { amount: true } }) : [];
  const ledgerMap = new Map(ledgerRows.map((r) => [r.referenceId, r]));
  let duplicateLedger = 0, ledgerInTotal = 0, ledgerInCount = 0, lost = 0, fakeCreditCount = 0, fakeCreditAmount = 0, historical = 0, historicalUnallocated = 0, unposted = 0;
  for (const p of payments) {
    const l = ledgerMap.get(p.id);
    if (l) { ledgerInCount += l._count._all; ledgerInTotal += l._sum.amount ?? 0; if (l._count._all > 1) duplicateLedger += l._count._all - 1; if ((l._sum.amount ?? 0) !== p.amount * l._count._all) lost += Math.abs((l._sum.amount ?? 0) - p.amount); }
    if (!p.postedAt) unposted++;
    const un = avail.get(p.id)?.unallocated ?? p.amount;
    if (p.legacyRole === null && un > 0) { fakeCreditCount++; fakeCreditAmount += un; }
    if (p.legacyRole === LEGACY_HISTORICAL_ROLE) { historical++; historicalUnallocated += un; }
    const r = reviews.find((x) => x.paymentId === p.id);
    if (r && r.amount !== p.amount) lost += Math.abs(r.amount - p.amount);
  }
  // Avans deb tasdiqlangan (legacyRole null, taqsimlanmagan) — soxta kredit emas
  for (const r of reviews.filter((x) => x.resolution === "ADVANCE")) {
    const p = payments.find((x) => x.id === r.paymentId);
    if (p && p.legacyRole === null) { const un = avail.get(p.id)?.unallocated ?? 0; if (un > 0) { fakeCreditCount--; fakeCreditAmount -= un; } }
  }
  const legacyTotal = payments.reduce((a, p) => a + p.amount, 0);
  const out: PreservationInvariant = {
    cutoverAt: at.toISOString(), legacyCount: payments.length, legacyTotal, preservedCount: payments.length, preservedTotal: legacyTotal, ledgerInCount, ledgerInTotal, unposted, duplicateLedger, lostAmount: lost,
    fakeCreditCount, fakeCreditAmount, historical, historicalUnallocated,
    reviews: { needsReview: reviews.filter((r) => r.status === "NEEDS_REVIEW").length, resolvedAllocated: reviews.filter((r) => r.resolution === "ALLOCATED").length, resolvedAdvance: reviews.filter((r) => r.resolution === "ADVANCE").length, unresolved: reviews.filter((r) => r.resolution === "UNRESOLVED").length },
    ok: false,
  };
  out.ok = out.lostAmount === 0 && out.duplicateLedger === 0 && out.fakeCreditCount === 0 && out.unposted === 0 && out.ledgerInCount === out.legacyCount && out.ledgerInTotal === out.legacyTotal;
  return out;
}
