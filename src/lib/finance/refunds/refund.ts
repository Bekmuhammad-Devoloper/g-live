// Finance V2 — qaytarim (Phase 7). Reja §9 + FINAL refund temporal rule:
//   Refund alohida fakt (Payment statusi o'zgarmaydi) → ledger OUT →
//   avval kredit (taqsimlanmagan) qismi, keyin ENG YANGI allocation'lar teskari
//   (PaymentAllocation{REVERSAL}) → har reversal × asl earning → REFUND_ADJUSTMENT
//   (manfiy, asl snapshot rateBp, earningMonth = asl earning oyi, settlement = asl
//   davr ochiq bo'lsa o'zi, APPROVED+ bo'lsa keyingi ochiq). Asl qatorlar o'zgarmaydi.
//   Σ refund ≤ payment.amount (tx ichida qayta tekshiriladi).
//
// Correction (`reversePayment`): to'liq CORRECTION refund + Payment.status=REVERSED
// + (ixtiyoriy) yangi to'g'ri to'lov `reversalOfId` bilan. Eski to'lov o'chirilmaydi.

import type { Payment, PaymentAllocation, PrismaClient, Refund, TeacherEarning } from "@prisma/client";
import { z } from "zod";

import { MAX_MONEY } from "@/lib/constants";
import type { SessionUser } from "@/lib/auth";
import { withFinanceTx, type FinanceDb } from "../db";
import { FinanceError } from "../errors";
import { financeAudit } from "../audit";
import { assertBranchAccess, requireFinancePermission } from "../permissions";
import { accountForMethod } from "../accounts/accounts";
import { postLedger } from "../ledger/post";
import { paymentAvailability, refreshChargeStatus, studentBalance, type StudentBalance } from "../billing/balance";
import { applyRateBp } from "../money";
import { tashkentYearMonth, yearMonthKey } from "../period";
import { assertPeriodOpen } from "../payments/periodLock";
import { acceptPaymentTx, type AcceptPaymentInput } from "../payments/accept";
import { settlementPeriodFor } from "../salary/periods";

export const refundSchema = z.object({
  paymentId: z.string().min(1),
  amount: z.number().int().positive().max(MAX_MONEY),
  reason: z.string().trim().min(3).max(500),
  kind: z.enum(["CASH_REFUND", "CORRECTION"]).default("CASH_REFUND"),
  financialAccountId: z.string().min(1).optional(),
  refundedAt: z.coerce.date(),
  idempotencyKey: z.string().min(8).max(128),
});
export type RefundInput = z.input<typeof refundSchema>;

export interface RefundResult {
  refund: Refund;
  reversals: PaymentAllocation[];
  adjustments: TeacherEarning[];
  balance: StudentBalance;
  replayed: boolean;
}

/** Bitta allocation'ning teskari qilinishi mumkin bo'lgan qoldig'i */
async function reversibleOf(db: FinanceDb, allocation: PaymentAllocation): Promise<number> {
  const rev = await db.paymentAllocation.aggregate({ _sum: { amount: true }, where: { reversalOfId: allocation.id, kind: "REVERSAL" } });
  return allocation.amount - (rev._sum.amount ?? 0);
}

/** Reversal × asl earning → manfiy tuzatish (asl snapshot rateBp), settlement ochiq davrga */
async function adjustEarningsForReversal(db: FinanceDb, reversal: PaymentAllocation, original: PaymentAllocation, refund: Refund, actorId: string | null): Promise<TeacherEarning[]> {
  const originals = await db.teacherEarning.findMany({ where: { allocationId: original.id, type: "PAYMENT_COMMISSION" } });
  const out: TeacherEarning[] = [];
  for (const e of originals) {
    if (!e.rateBp || e.amount === 0) continue;
    // Tuzatish asl earning'ga proporsional: reversal / asl allocation × asl amount (yaxlitlash asl bilan bir xil bp orqali)
    const eligibleShare = Math.round((e.eligibleAmount * reversal.amount) / original.amount);
    // Yaxlitlash: qisman qaytarimlar yig'indisi asl earning'dan oshmasin (oldingi tuzatishlar hisobga olinadi)
    const priorAdj = await db.teacherEarning.aggregate({ _sum: { amount: true }, where: { reversalOfId: e.id, type: "REFUND_ADJUSTMENT" } });
    const remainingAdj = e.amount + (priorAdj._sum.amount ?? 0); // asl − |oldingi tuzatishlar|
    const amount = -Math.min(applyRateBp(eligibleShare, e.rateBp), Math.max(0, remainingAdj));
    if (amount === 0) continue;
    const idempotencyKey = `alloc:${reversal.id}:asg:${e.assignmentId ?? "-"}`;
    const already = await db.teacherEarning.findUnique({ where: { idempotencyKey } });
    if (already) { out.push(already); continue; }
    const earningMonth = { year: e.earningYear, month: e.earningMonth };
    const settlement = e.status === "POSTED" ? await settlementPeriodFor(db, e.teacherId, earningMonth) : null;
    const row = await db.teacherEarning.create({
      data: {
        teacherId: e.teacherId, studentId: e.studentId, sourcePaymentId: e.sourcePaymentId, allocationId: reversal.id, chargeId: e.chargeId, refundId: refund.id,
        groupId: e.groupId, programId: e.programId, branchId: e.branchId, policyId: e.policyId, ruleId: e.ruleId, assignmentId: e.assignmentId,
        serviceYear: e.serviceYear, serviceMonth: e.serviceMonth, receivedAt: e.receivedAt, earningYear: e.earningYear, earningMonth: e.earningMonth,
        settlementPeriodId: settlement?.id ?? null, baseAmount: -Math.round((e.baseAmount * reversal.amount) / original.amount), eligibleAmount: -eligibleShare, rateBp: e.rateBp,
        amount, type: "REFUND_ADJUSTMENT", status: e.status, reviewReason: e.reviewReason, reversalOfId: e.id,
        snapshot: JSON.stringify({ refundId: refund.id, refundedAt: refund.refundedAt.toISOString(), reversalAllocationId: reversal.id, originalEarningId: e.id, originalAmount: e.amount, reversedAmount: reversal.amount, ofAllocation: original.amount, rateBp: e.rateBp, earningMonth: yearMonthKey(earningMonth), settlementPeriodId: settlement?.id ?? null, tz: "Asia/Tashkent" }),
        idempotencyKey, createdById: actorId,
      },
    });
    out.push(row);
  }
  return out;
}

/** Sof dvigatel (tranzaksiya ichida) */
export async function createRefundTx(db: FinanceDb, raw: RefundInput, actor: Pick<SessionUser, "userId" | "role" | "branchId">, now = new Date()): Promise<RefundResult> {
  const input = refundSchema.parse(raw);
  const replay = await db.refund.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (replay) {
    const reversals = await db.paymentAllocation.findMany({ where: { refundId: replay.id } });
    const adjustments = await db.teacherEarning.findMany({ where: { refundId: replay.id } });
    return { refund: replay, reversals, adjustments, balance: await studentBalance(db, replay.studentId), replayed: true };
  }
  const payment = await db.payment.findUnique({ where: { id: input.paymentId } });
  if (!payment) throw new FinanceError("not_found", "To'lov topilmadi");
  if (payment.legacyRole === "HISTORICAL") throw new FinanceError("state", "Tarixiy real to'lov — avval Finance V2 → Tarixiy to'lovlar bo'limida qaror qabul qilinsin (taqsimlash yoki dalil bilan avans); shundan keyingina qaytariladi");
  if (payment.status !== "PAID" || payment.legacyRole || !payment.postedAt) throw new FinanceError("state", "Faqat V2 ga kiritilgan PAID to'lov qaytariladi");
  assertBranchAccess(actor, payment.branchId);
  await assertPeriodOpen(db, payment.branchId, tashkentYearMonth(input.refundedAt));
  if (input.refundedAt.getTime() > now.getTime() + 60 * 60 * 1000) throw new FinanceError("validation", "Qaytarim sanasi kelajakda bo'lishi mumkin emas");
  if (payment.receivedAt && input.refundedAt < payment.receivedAt) throw new FinanceError("validation", "Qaytarim to'lovdan oldin bo'lishi mumkin emas");

  // Σ refund ≤ amount (tx ichida)
  const done = await db.refund.aggregate({ _sum: { amount: true }, where: { originalPaymentId: payment.id, status: "DONE" } });
  const refundedSoFar = done._sum.amount ?? 0;
  if (refundedSoFar + input.amount > payment.amount) throw new FinanceError("insufficient", "Qaytarim to'lov summasidan oshadi", { paymentAmount: payment.amount, refundedSoFar, requested: input.amount });

  const account = input.financialAccountId
    ? await db.financialAccount.findUnique({ where: { id: input.financialAccountId } })
    : payment.financialAccountId ? await db.financialAccount.findUnique({ where: { id: payment.financialAccountId } }) : await accountForMethod(db, payment.branchId, "CASH", actor.userId);
  if (!account || !account.isActive) throw new FinanceError("validation", "Kassa topilmadi yoki faol emas");

  const refund = await db.refund.create({
    data: {
      originalPaymentId: payment.id, studentId: payment.studentId, branchId: payment.branchId, amount: input.amount, reason: input.reason, kind: input.kind,
      financialAccountId: account.id, refundedAt: input.refundedAt, status: "DONE", source: "V2", idempotencyKey: input.idempotencyKey, createdById: actor.userId,
    },
  });
  await postLedger(db, { accountId: account.id, branchId: account.branchId ?? payment.branchId, type: "REFUND", direction: "OUT", amount: input.amount, referenceType: "Refund", referenceId: refund.id, occurredAt: input.refundedAt, actorId: actor.userId, note: input.reason });

  // Avval kredit qismi (qator yozilmaydi — unallocated formulasi refundni ayiradi), keyin eng yangi allocation'lar
  const availBefore = (await paymentAvailability(db, [payment.id])).get(payment.id)!;
  const creditBeforeRefund = availBefore.unallocated + input.amount; // hozirgi refund allaqachon ayirilgan
  let toReverse = Math.max(0, input.amount - Math.max(0, creditBeforeRefund));
  const reversals: PaymentAllocation[] = [];
  const adjustments: TeacherEarning[] = [];
  if (toReverse > 0) {
    const originals = await db.paymentAllocation.findMany({ where: { paymentId: payment.id, kind: "ALLOCATION" }, orderBy: [{ allocatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }] }); // LIFO, deterministik
    for (const orig of originals) {
      if (toReverse <= 0) break;
      const reversible = await reversibleOf(db, orig);
      if (reversible <= 0) continue;
      const amount = Math.min(reversible, toReverse);
      const rev = await db.paymentAllocation.create({
        data: { paymentId: payment.id, chargeId: orig.chargeId, amount, kind: "REVERSAL", reversalOfId: orig.id, refundId: refund.id, source: "MANUAL", allocatedAt: now, idempotencyKey: `rev:${orig.id}:${refund.id}`, createdById: actor.userId },
      });
      reversals.push(rev);
      toReverse -= amount;
      await refreshChargeStatus(db, orig.chargeId);
      adjustments.push(...(await adjustEarningsForReversal(db, rev, orig, refund, actor.userId)));
    }
    if (toReverse > 0) throw new FinanceError("conflict", "Qaytarim uchun teskari qilinadigan taqsimot yetarli emas", { left: toReverse });
  }
  await financeAudit(db, {
    actorId: actor.userId, action: "REFUND", entityType: "Refund", entityId: refund.id,
    newValue: { paymentId: payment.id, amount: input.amount, kind: input.kind, accountId: account.id, reversals: reversals.map((r) => ({ id: r.id, amount: r.amount, chargeId: r.chargeId })), adjustments: adjustments.map((a) => ({ id: a.id, teacherId: a.teacherId, amount: a.amount })) },
    reason: input.reason,
  });
  return { refund, reversals, adjustments, balance: await studentBalance(db, payment.studentId), replayed: false };
}

export async function createRefund(client: PrismaClient, input: RefundInput, actor: Pick<SessionUser, "userId" | "role" | "branchId">, now = new Date()): Promise<RefundResult> {
  requireFinancePermission(actor, input.kind === "CORRECTION" ? "PAYMENT_CORRECT" : "PAYMENT_CANCEL");
  return withFinanceTx(client, (tx) => createRefundTx(tx, input, actor, now));
}

export interface ReversePaymentInput {
  paymentId: string;
  reason: string;
  idempotencyKey: string;
  /** to'g'ri to'lov (bo'lmasa faqat bekor qilinadi) */
  replacement?: Omit<AcceptPaymentInput, "studentId"> | null;
}

export interface ReversePaymentResult {
  refund: RefundResult;
  reversed: Payment;
  replacement: Payment | null;
}

/** Correction: to'liq CORRECTION refund + status REVERSED + (ixtiyoriy) yangi to'lov `reversalOfId` bilan */
export async function reversePayment(client: PrismaClient, i: ReversePaymentInput, actor: Pick<SessionUser, "userId" | "role" | "branchId">, now = new Date()): Promise<ReversePaymentResult> {
  requireFinancePermission(actor, "PAYMENT_CORRECT");
  return withFinanceTx(client, async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: i.paymentId } });
    if (!payment) throw new FinanceError("not_found", "To'lov topilmadi");
    if (payment.status === "REVERSED") throw new FinanceError("state", "To'lov allaqachon bekor qilingan (REVERSED)");
    const done = await tx.refund.aggregate({ _sum: { amount: true }, where: { originalPaymentId: payment.id, status: "DONE" } });
    const remaining = payment.amount - (done._sum.amount ?? 0);
    if (remaining <= 0) throw new FinanceError("state", "To'lov allaqachon to'liq qaytarilgan");
    const refund = await createRefundTx(tx, {
      paymentId: payment.id, amount: remaining, reason: i.reason, kind: "CORRECTION", refundedAt: now, idempotencyKey: `${i.idempotencyKey}:refund`,
      financialAccountId: payment.financialAccountId ?? undefined,
    }, actor, now);
    const reversed = await tx.payment.update({ where: { id: payment.id }, data: { status: "REVERSED", cancelledAt: now, cancelReason: i.reason } });
    let replacement: Payment | null = null;
    if (i.replacement) {
      const r = await acceptPaymentTx(tx, { ...i.replacement, studentId: payment.studentId, idempotencyKey: `${i.idempotencyKey}:replacement` }, actor, now);
      replacement = await tx.payment.update({ where: { id: r.payment.id }, data: { reversalOfId: payment.id } });
    }
    await financeAudit(tx, { actorId: actor.userId, action: "REVERSE", entityType: "Payment", entityId: payment.id, oldValue: { status: payment.status, amount: payment.amount }, newValue: { status: "REVERSED", refundId: refund.refund.id, replacementId: replacement?.id ?? null }, reason: i.reason });
    return { refund, reversed, replacement };
  });
}
