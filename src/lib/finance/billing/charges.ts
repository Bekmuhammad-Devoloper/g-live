// Finance V2 — StudentCharge (invoice) dvigateli: oylik charge yaratish
// (idempotent, chargeKey), qo'lda qarz, bekor qilish, almashtirish, tuzatish.
//
// Qoidalar: FULL_MONTH (S3) — qo'shilgan/chiqqan oy to'liq; guruh a'zoligisiz
// oy — charge yo'q (S2); to'liq oy FROZEN — 0 summali WAIVED charge (S4);
// narx: group.monthlyFee → program.monthlyFee → Setting finance.defaultMonthlyFee;
// chegirma snapshot'da immutable. Bekor qilingan charge qayta tiriltirilmaydi —
// almashtiruvchi/tuzatuvchi yangi charge lineage bilan (D3).

import { randomUUID } from "node:crypto";
import type { StudentCharge } from "@prisma/client";

import type { FinanceDb } from "../db";
import { isUniqueViolation } from "../db";
import { FinanceError } from "../errors";
import { financeAudit } from "../audit";
import { assertMoney, assertPositiveMoney } from "../money";
import { compareYearMonth, monthEnd, monthsBetween, tashkentDate, tashkentYearMonth, yearMonthKey, type YearMonth } from "../period";
import { resolveBillingPolicy, type BillingPolicyView } from "./policy";
import { resolveDiscount } from "./discounts";
import { resolveFee, type FeeResolution, type UnpricedItem } from "./fees";
import { intervalCoversMonth, intervalTouchesMonth, membershipIntervals, statusIntervals, syncStudentHistory, type Interval } from "./history";
import { chargeNetAllocated } from "./balance";

export { DEFAULT_FEE_SETTING_KEY } from "./fees";

export const monthlyChargeKey = (studentId: string, groupId: string, ym: YearMonth) => `${studentId}:${groupId}:${yearMonthKey(ym)}`;

export interface EnsureChargesOptions {
  studentId: string;
  /** shu oygacha (shu oy ham) — odatda joriy Tashkent oyi */
  upTo?: YearMonth;
  actorId?: string | null;
  cutoverAt?: Date;
  now?: Date;
}

export interface EnsureChargesResult {
  created: StudentCharge[];
  /** allaqachon bor edi */
  existing: number;
  /** yaratilmagan oylar (sabab bilan) */
  skipped: { groupId: string; month: string; reason: string }[];
  /** narx sozlanmagan oylar — MONTHLY_FEE_NOT_CONFIGURED (charge yo'q, 0 deb taxmin qilinmaydi) */
  unpriced: UnpricedItem[];
}

/** Interval qaysi oylarga tegadi (from oyi … to oyi, `upTo` bilan cheklangan) */
function monthsOfInterval(iv: Interval, upTo: YearMonth): YearMonth[] {
  const first = tashkentYearMonth(iv.from);
  const lastRaw = iv.to ? tashkentYearMonth(new Date(iv.to.getTime() - 1)) : upTo;
  const last = compareYearMonth(lastRaw, upTo) > 0 ? upTo : lastRaw;
  return monthsBetween(first, last);
}

/**
 * O'quvchining barcha a'zolik oylari uchun MONTHLY charge'lar borligini ta'minlaydi.
 * Idempotent: chargeKey unique; parallel chaqiruvda P2002 → "bor" deb hisoblanadi.
 */
export async function ensureMonthlyCharges(db: FinanceDb, o: EnsureChargesOptions): Promise<EnsureChargesResult> {
  const now = o.now ?? new Date();
  const upTo = o.upTo ?? tashkentYearMonth(now);
  await syncStudentHistory(db, o.studentId, { at: now, actorId: o.actorId, cutoverAt: o.cutoverAt });

  const student = await db.student.findUnique({ where: { id: o.studentId }, select: { id: true, branchId: true } });
  if (!student) throw new FinanceError("not_found", "O'quvchi topilmadi");
  const [memberships, statuses] = await Promise.all([membershipIntervals(db, o.studentId), statusIntervals(db, o.studentId)]);

  const result: EnsureChargesResult = { created: [], existing: 0, skipped: [], unpriced: [] };
  const feeCache = new Map<string, FeeResolution | null>();
  const groupMeta = new Map<string, { programId: string; branchId: string | null }>();

  for (const iv of memberships) {
    for (const ym of monthsOfInterval(iv, upTo)) {
      const key = monthlyChargeKey(o.studentId, iv.key, ym);
      const exists = await db.studentCharge.findUnique({ where: { chargeKey: key }, select: { id: true } });
      if (exists) { result.existing++; continue; }

      let meta = groupMeta.get(iv.key);
      if (!meta) {
        const g = await db.group.findUnique({ where: { id: iv.key }, select: { programId: true, branchId: true } });
        meta = { programId: g?.programId ?? "", branchId: g?.branchId ?? student.branchId };
        groupMeta.set(iv.key, meta);
      }
      // Narx: kelishilgan → guruh → kurs → filial standarti → global (fees.ts). Kelishilgan narx oyga bog'liq — kesh kaliti oy bilan.
      const feeKey = `${iv.key}:${yearMonthKey(ym)}`;
      let fee = feeCache.get(feeKey);
      if (fee === undefined) { fee = await resolveFee(db, { studentId: o.studentId, groupId: iv.key, branchId: meta.branchId ?? student.branchId, serviceMonth: ym }); feeCache.set(feeKey, fee); }
      if (!fee) {
        result.skipped.push({ groupId: iv.key, month: yearMonthKey(ym), reason: "narx belgilanmagan (MONTHLY_FEE_NOT_CONFIGURED)" });
        result.unpriced.push({ studentId: o.studentId, groupId: iv.key, month: yearMonthKey(ym) });
        continue;
      }
      const policy = await resolveBillingPolicy(db, meta.branchId ?? student.branchId, ym);
      // S4 to'liq oy FROZEN → 0. Faqat KNOWN (cutover'dan keyingi, hook yozgan) holat intervali va faqat OY TUGAGACH
      // hal qilinadi: ochiq FROZEN interval oy o'rtasida "butun oy" deb taxmin qilinmaydi — charge keyinga qoldiriladi.
      // INFERRED (legacy) FROZEN — moliyaviy fakt taxmin qilinmaydi: legacy kabi to'liq charge (snapshot'da belgilanadi).
      const frozenKnown = statuses.filter((s) => s.key === "FROZEN" && s.source === "KNOWN" && intervalCoversMonth(s, ym));
      const monthElapsed = now >= monthEnd(ym);
      if (frozenKnown.some((s) => s.to === null) && !monthElapsed) {
        result.skipped.push({ groupId: iv.key, month: yearMonthKey(ym), reason: "muzlatilgan (FROZEN) — oy tugagach hal qilinadi" });
        continue;
      }
      const frozenFullMonth = frozenKnown.length > 0;
      const frozenInferred = !frozenFullMonth && statuses.some((s) => s.key === "FROZEN" && s.source === "INFERRED" && intervalCoversMonth(s, ym));
      // Kelishilgan narx = yakuniy summa (ustiga PERCENT/FIXED chegirma qo'llanmaydi); asl = ro'yxat narxi (bo'lsa), farq = chegirma sifatida yoziladi
      const originalAmount = fee.source === "agreed" ? Math.max(fee.listAmount ?? fee.amount, fee.amount) : fee.amount;
      const discount = frozenFullMonth || fee.source === "agreed" ? { applied: null, candidates: [] } : await resolveDiscount(db, o.studentId, iv.key, ym, fee.amount);
      const discountAmount = fee.source === "agreed" ? originalAmount - fee.amount : (discount.applied?.amount ?? 0);
      const finalAmount = frozenFullMonth && policy.frozenFullMonthMode === "ZERO_CHARGE" ? 0 : originalAmount - discountAmount;
      const snapshot = {
        policy: { id: policy.id, version: policy.version, midMonthJoinMode: policy.midMonthJoinMode, dueDay: policy.dueDay, frozenFullMonthMode: policy.frozenFullMonthMode },
        fee: { amount: fee.amount, source: fee.source, listAmount: fee.listAmount, listSource: fee.listSource, agreedPriceId: fee.agreedPriceId },
        membership: { groupId: iv.key, from: iv.from.toISOString(), to: iv.to?.toISOString() ?? null, source: iv.source },
        statuses: statuses.filter((s) => intervalTouchesMonth(s, ym)).map((s) => ({ status: s.key, from: s.from.toISOString(), to: s.to?.toISOString() ?? null, source: s.source })),
        frozenFullMonth,
        frozenInferred, // legacy holat: to'liq charge, lekin ko'rib chiqish uchun belgi
        discount,
        generatedAt: now.toISOString(),
      };
      try {
        const created = await db.studentCharge.create({
          data: {
            studentId: o.studentId, branchId: meta.branchId ?? student.branchId, groupId: iv.key, programId: meta.programId || null,
            billingPolicyId: policy.id, kind: "MONTHLY", serviceYear: ym.year, serviceMonth: ym.month,
            originalAmount: assertMoney(originalAmount, "narx"), discountAmount: assertMoney(discountAmount, "chegirma"), finalAmount: assertMoney(finalAmount, "yakuniy"),
            dueDate: tashkentDate(ym, policy.dueDay), status: finalAmount === 0 ? "WAIVED" : "OPEN",
            chargeKey: key, snapshot: JSON.stringify(snapshot), createdById: o.actorId ?? null,
          },
        });
        result.created.push(created);
      } catch (e) {
        if (isUniqueViolation(e)) { result.existing++; continue; } // parallel chaqiruv yozib ulgurdi
        throw e;
      }
    }
  }
  return result;
}

export interface ManualDebtInput {
  studentId: string;
  amount: number;
  serviceMonth: YearMonth;
  note?: string | null;
  actorId?: string | null;
  /** eski PENDING Payment qatoridan ko'chirilgan bo'lsa */
  legacyPaymentId?: string | null;
  now?: Date;
}

/** Qo'lda qarz (MANUAL_DEBT) — guruhga bog'liq emas; legacy PENDING ham shu orqali ko'chadi */
export async function createManualDebtCharge(db: FinanceDb, i: ManualDebtInput): Promise<StudentCharge> {
  assertPositiveMoney(i.amount, "qarz summasi");
  const student = await db.student.findUnique({ where: { id: i.studentId }, select: { branchId: true } });
  if (!student) throw new FinanceError("not_found", "O'quvchi topilmadi");
  const policy = await resolveBillingPolicy(db, student.branchId, i.serviceMonth);
  const id = randomUUID();
  const chargeKey = i.legacyPaymentId ? `legacy:${i.legacyPaymentId}` : `manual:${id}`;
  const created = await db.studentCharge.create({
    data: {
      id, studentId: i.studentId, branchId: student.branchId, billingPolicyId: policy.id, kind: "MANUAL_DEBT",
      serviceYear: i.serviceMonth.year, serviceMonth: i.serviceMonth.month, originalAmount: i.amount, discountAmount: 0, finalAmount: i.amount,
      dueDate: tashkentDate(i.serviceMonth, policy.dueDay), status: "OPEN", chargeKey, legacyPaymentId: i.legacyPaymentId ?? null,
      note: i.note ?? null, snapshot: JSON.stringify({ kind: "MANUAL_DEBT", legacyPaymentId: i.legacyPaymentId ?? null, generatedAt: (i.now ?? new Date()).toISOString() }),
      createdById: i.actorId ?? null,
    },
  });
  await financeAudit(db, { actorId: i.actorId, action: "CREATE", entityType: "StudentCharge", entityId: created.id, newValue: { kind: "MANUAL_DEBT", amount: i.amount, serviceMonth: yearMonthKey(i.serviceMonth) }, reason: i.note ?? null });
  return created;
}

async function loadCharge(db: FinanceDb, chargeId: string): Promise<StudentCharge> {
  const c = await db.studentCharge.findUnique({ where: { id: chargeId } });
  if (!c) throw new FinanceError("not_found", "Charge topilmadi");
  return c;
}

async function assertNoAllocations(db: FinanceDb, charge: StudentCharge): Promise<void> {
  const net = await chargeNetAllocated(db, charge.id);
  if (net !== 0) throw new FinanceError("state", "Charge'ga to'lov taqsimlangan — avval taqsimotni teskari qiling (refund/correction)", { allocated: net });
}

/** Bekor qilish — faqat taqsimotsiz OPEN charge; qator o'chirilmaydi, status CANCELLED */
export async function cancelCharge(db: FinanceDb, chargeId: string, reason: string, actorId?: string | null, now = new Date()): Promise<StudentCharge> {
  if (reason.trim().length < 3) throw new FinanceError("validation", "Sabab kamida 3 belgi");
  const c = await loadCharge(db, chargeId);
  if (c.status === "CANCELLED") throw new FinanceError("state", "Charge allaqachon bekor qilingan");
  if (c.status === "WAIVED") throw new FinanceError("state", "0 summali charge bekor qilinmaydi");
  await assertNoAllocations(db, c);
  const updated = await db.studentCharge.update({ where: { id: c.id }, data: { status: "CANCELLED", cancelledAt: now, cancelReason: reason.trim(), cancelledById: actorId ?? null } });
  await financeAudit(db, { actorId, action: "CANCEL", entityType: "StudentCharge", entityId: c.id, oldValue: { status: c.status, finalAmount: c.finalAmount }, newValue: { status: "CANCELLED" }, reason });
  return updated;
}

export interface ReplaceChargeInput {
  chargeId: string;
  originalAmount: number;
  discountAmount?: number;
  reason: string;
  actorId?: string | null;
  now?: Date;
}

/** Almashtirish (D3): eski bekor qilinadi (taqsimotsiz bo'lsa), yangisi `replacesChargeId` bilan; kalit `${eski}:adj:${yangi id}` */
export async function replaceCharge(db: FinanceDb, i: ReplaceChargeInput): Promise<StudentCharge> {
  const now = i.now ?? new Date();
  const old = await loadCharge(db, i.chargeId);
  if (old.status === "CANCELLED") throw new FinanceError("state", "Bekor qilingan charge qayta almashtirilmaydi — uning o'rnini bosuvchi bilan ishlang");
  const discountAmount = i.discountAmount ?? 0;
  assertMoney(i.originalAmount, "narx");
  assertMoney(discountAmount, "chegirma");
  if (discountAmount > i.originalAmount) throw new FinanceError("validation", "Chegirma narxdan katta");
  await cancelCharge(db, old.id, i.reason, i.actorId, now);
  const id = randomUUID();
  const finalAmount = i.originalAmount - discountAmount;
  const created = await db.studentCharge.create({
    data: {
      id, studentId: old.studentId, branchId: old.branchId, groupId: old.groupId, programId: old.programId, billingPolicyId: old.billingPolicyId,
      kind: old.kind, serviceYear: old.serviceYear, serviceMonth: old.serviceMonth, originalAmount: i.originalAmount, discountAmount, finalAmount,
      dueDate: old.dueDate, status: finalAmount === 0 ? "WAIVED" : "OPEN", chargeKey: `${old.chargeKey}:adj:${id}`, replacesChargeId: old.id,
      snapshot: JSON.stringify({ replaces: old.id, reason: i.reason, previous: { originalAmount: old.originalAmount, discountAmount: old.discountAmount, finalAmount: old.finalAmount }, generatedAt: now.toISOString() }),
      createdById: i.actorId ?? null,
    },
  });
  await financeAudit(db, { actorId: i.actorId, action: "REPLACE", entityType: "StudentCharge", entityId: created.id, oldValue: { replaces: old.id, finalAmount: old.finalAmount }, newValue: { finalAmount }, reason: i.reason });
  return created;
}

export interface AdjustChargeInput {
  chargeId: string;
  /** qo'shimcha summa (> 0). Kamaytirish — replaceCharge orqali */
  amount: number;
  reason: string;
  actorId?: string | null;
  now?: Date;
}

/** Tuzatish (D3): asl charge o'zgarmaydi, unga bog'langan yangi ADJUSTMENT charge (one-to-many) */
export async function adjustCharge(db: FinanceDb, i: AdjustChargeInput): Promise<StudentCharge> {
  const now = i.now ?? new Date();
  assertPositiveMoney(i.amount, "tuzatish summasi");
  if (i.reason.trim().length < 3) throw new FinanceError("validation", "Sabab kamida 3 belgi");
  const base = await loadCharge(db, i.chargeId);
  if (base.status === "CANCELLED") throw new FinanceError("state", "Bekor qilingan charge tuzatilmaydi");
  const id = randomUUID();
  const created = await db.studentCharge.create({
    data: {
      id, studentId: base.studentId, branchId: base.branchId, groupId: base.groupId, programId: base.programId, billingPolicyId: base.billingPolicyId,
      kind: "ADJUSTMENT", serviceYear: base.serviceYear, serviceMonth: base.serviceMonth, originalAmount: i.amount, discountAmount: 0, finalAmount: i.amount,
      dueDate: base.dueDate, status: "OPEN", chargeKey: `adj:${base.id}:${id}`, adjustsChargeId: base.id,
      snapshot: JSON.stringify({ adjusts: base.id, reason: i.reason, generatedAt: now.toISOString() }), note: i.reason, createdById: i.actorId ?? null,
    },
  });
  await financeAudit(db, { actorId: i.actorId, action: "ADJUST", entityType: "StudentCharge", entityId: created.id, oldValue: { adjusts: base.id }, newValue: { amount: i.amount }, reason: i.reason });
  return created;
}

export type { BillingPolicyView };
