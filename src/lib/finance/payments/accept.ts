// Finance V2 — to'lov qabul qilish (Phase 4). Reja §8:
//   validate → RBAC → period lock → idempotency → TX: Payment → ledger IN →
//   charge'lar (lazy) → mavjud kreditni qo'llash → FIFO allocation → qoldiq = kredit →
//   holatlar → audit → COMMIT. Bildirishnoma — action qatlamida, commit'dan keyin.
//
// receivedAt = pul REAL kelgan vaqt (createdAt emas). Double-click: idempotencyKey
// unique — ikkinchi chaqiruv mavjud to'lovni qaytaradi (yangi yozuv yo'q).

import { randomUUID } from "node:crypto";
import type { Payment, PaymentAllocation, PrismaClient } from "@prisma/client";
import { z } from "zod";

import { MAX_MONEY, PAYMENT_METHODS } from "@/lib/constants";
import type { SessionUser } from "@/lib/auth";
import { withFinanceTx, type FinanceDb } from "../db";
import { FinanceError } from "../errors";
import { financeAudit } from "../audit";
import { assertBranchAccess, requireFinancePermission } from "../permissions";
import { accountForMethod } from "../accounts/accounts";
import { postLedger } from "../ledger/post";
import { ensureMonthlyCharges } from "../billing/charges";
import { studentBalance, type StudentBalance } from "../billing/balance";
import { tashkentYearMonth } from "../period";
import { assertPeriodOpen } from "./periodLock";
import { allocateFifo, applyStudentCredit } from "./allocate";

const METHODS = [...PAYMENT_METHODS, "HUMO"] as const;

export const acceptPaymentSchema = z.object({
  studentId: z.string().min(1),
  amount: z.number().int().positive().max(MAX_MONEY),
  method: z.enum(METHODS as unknown as [string, ...string[]]),
  /** pul real kelgan vaqt */
  receivedAt: z.coerce.date(),
  purpose: z.string().trim().min(2).max(200),
  financialAccountId: z.string().min(1).optional(),
  docNumber: z.string().trim().max(64).optional(),
  receiptUrl: z.string().trim().max(2000).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  /** klient yaratadi (uuid) — double-click himoyasi */
  idempotencyKey: z.string().min(8).max(128),
});
export type AcceptPaymentInput = z.infer<typeof acceptPaymentSchema>;

export interface AcceptPaymentResult {
  payment: Payment;
  allocations: PaymentAllocation[];
  /** oldingi kreditdan yangi charge'larga qo'llanganlar */
  creditApplied: PaymentAllocation[];
  balance: StudentBalance;
  /** idempotent qayta chaqiruv — hech narsa yozilmadi */
  replayed: boolean;
}

const p2 = (n: number) => String(n).padStart(2, "0");
const docNumberFor = (at: Date) => `CHK-${at.getFullYear()}${p2(at.getMonth() + 1)}${p2(at.getDate())}-${randomUUID().slice(0, 4).toUpperCase()}`;

/** Sof dvigatel (tranzaksiya ichida). Action qatlami `acceptPayment` ni ishlatadi. */
export async function acceptPaymentTx(db: FinanceDb, raw: AcceptPaymentInput, actor: Pick<SessionUser, "userId" | "role" | "branchId">, now = new Date()): Promise<AcceptPaymentResult> {
  const input = acceptPaymentSchema.parse(raw);
  if (input.receivedAt.getTime() > now.getTime() + 60 * 60 * 1000) throw new FinanceError("validation", "To'lov sanasi kelajakda bo'lishi mumkin emas");

  // 1. Idempotency — mavjud bo'lsa qaytaramiz
  const replay = await db.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (replay) {
    const allocations = await db.paymentAllocation.findMany({ where: { paymentId: replay.id }, orderBy: { createdAt: "asc" } });
    return { payment: replay, allocations, creditApplied: [], balance: await studentBalance(db, replay.studentId), replayed: true };
  }

  const student = await db.student.findUnique({ where: { id: input.studentId }, select: { id: true, branchId: true, fullName: true } });
  if (!student) throw new FinanceError("not_found", "O'quvchi topilmadi");
  assertBranchAccess(actor, student.branchId);
  await assertPeriodOpen(db, student.branchId, tashkentYearMonth(input.receivedAt));

  const account = input.financialAccountId
    ? await db.financialAccount.findUnique({ where: { id: input.financialAccountId } })
    : await accountForMethod(db, student.branchId, input.method, actor.userId);
  if (!account || !account.isActive) throw new FinanceError("validation", "Kassa topilmadi yoki faol emas");
  assertBranchAccess(actor, account.branchId ?? student.branchId);

  // 2. Payment (real pul)
  const payment = await db.payment.create({
    data: {
      studentId: student.id, amount: input.amount, method: input.method, purpose: input.purpose, status: "PAID", isManual: true,
      docNumber: input.docNumber || docNumberFor(input.receivedAt), receiptUrl: input.receiptUrl ?? null, note: input.note ?? null,
      authorId: actor.userId, receivedAt: input.receivedAt, branchId: student.branchId, financialAccountId: account.id,
      idempotencyKey: input.idempotencyKey, postedAt: now,
    },
  });

  // 3. Ledger IN
  await postLedger(db, { accountId: account.id, branchId: account.branchId ?? student.branchId, type: "STUDENT_PAYMENT", direction: "IN", amount: payment.amount, referenceType: "Payment", referenceId: payment.id, occurredAt: input.receivedAt, actorId: actor.userId, note: input.purpose });

  // 4. Charge'lar (lazy) → 5. oldingi kredit → 6. shu to'lov FIFO → qoldiq = kredit
  await ensureMonthlyCharges(db, { studentId: student.id, upTo: tashkentYearMonth(now), actorId: actor.userId, now });
  // Avval OLDINGI kredit (eng eski manba to'lov birinchi), keyin shu to'lov
  const creditApplied = await applyStudentCredit(db, student.id, { actorId: actor.userId, excludePaymentId: payment.id });
  const allocations = await allocateFifo(db, { paymentId: payment.id, studentId: student.id, available: payment.amount, source: "AUTO_FIFO", actorId: actor.userId, allocatedAt: now });

  // 7. Audit — to'lov + (agar bo'lsa) taqsimot alohida qator (allocation auditi)
  const allocated = allocations.reduce((a, r) => a + r.amount, 0);
  if (allocations.length > 0 || creditApplied.length > 0) {
    await financeAudit(db, {
      actorId: actor.userId, action: "ALLOCATE", entityType: "PaymentAllocation", entityId: payment.id,
      newValue: { paymentId: payment.id, allocations: allocations.map((a) => ({ id: a.id, chargeId: a.chargeId, amount: a.amount, source: a.source })), creditApplied: creditApplied.map((a) => ({ id: a.id, chargeId: a.chargeId, amount: a.amount, paymentId: a.paymentId })) },
    });
  }
  await financeAudit(db, {
    actorId: actor.userId, action: "CREATE", entityType: "Payment", entityId: payment.id,
    newValue: { amount: payment.amount, method: payment.method, receivedAt: input.receivedAt.toISOString(), accountId: account.id, allocated, credit: payment.amount - allocated, docNumber: payment.docNumber },
    reason: input.purpose,
  });
  return { payment, allocations, creditApplied, balance: await studentBalance(db, student.id), replayed: false };
}

/** Action qatlami uchun: RBAC + bitta tranzaksiya (qayta urinish bilan) */
export async function acceptPayment(client: PrismaClient, input: AcceptPaymentInput, actor: Pick<SessionUser, "userId" | "role" | "branchId">, now = new Date()): Promise<AcceptPaymentResult> {
  requireFinancePermission(actor, "PAYMENT_CREATE");
  return withFinanceTx(client, (tx) => acceptPaymentTx(tx, input, actor, now));
}
