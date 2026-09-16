// Finance V2 — kassalar orasida o'tkazma (Transfer). Xarajat EMAS: ledgerda
// FROM uchun TRANSFER_OUT va TO uchun TRANSFER_IN — bitta tranzaksiyada, bir
// referenceId. Teskari qilish — yangi Transfer (reversalOfId), asl qator o'zgarmaydi.

import type { PrismaClient, Transfer } from "@prisma/client";
import { z } from "zod";

import { MAX_MONEY } from "@/lib/constants";
import type { SessionUser } from "@/lib/auth";
import { withFinanceTx, type FinanceDb } from "../db";
import { FinanceError } from "../errors";
import { financeAudit } from "../audit";
import { assertBranchAccess, hasFinancePermission, requireFinancePermission } from "../permissions";
import { postLedger } from "../ledger/post";
import { tashkentYearMonth } from "../period";
import { assertPeriodOpen } from "../payments/periodLock";
import { accountBalance } from "./balances";

export const transferSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: z.number().int().positive().max(MAX_MONEY),
  occurredAt: z.coerce.date(),
  note: z.string().trim().max(500).optional().nullable(),
  idempotencyKey: z.string().min(8).max(128),
  /** balans yetarli bo'lmasa ham o'tkazish (faqat DIRECTOR/DEPUTY, sabab bilan) */
  allowNegative: z.boolean().optional(),
});
export type TransferInput = z.input<typeof transferSchema>;

export async function createTransferTx(db: FinanceDb, raw: TransferInput, actor: Pick<SessionUser, "userId" | "role" | "branchId">, now = new Date()): Promise<{ transfer: Transfer; replayed: boolean }> {
  const input = transferSchema.parse(raw);
  const replay = await db.transfer.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (replay) return { transfer: replay, replayed: true };
  if (input.fromAccountId === input.toAccountId) throw new FinanceError("validation", "Bir kassadan o'ziga o'tkazib bo'lmaydi");
  if (input.occurredAt.getTime() > now.getTime() + 60 * 60 * 1000) throw new FinanceError("validation", "Sana kelajakda bo'lishi mumkin emas");
  const [from, to] = await Promise.all([db.financialAccount.findUnique({ where: { id: input.fromAccountId } }), db.financialAccount.findUnique({ where: { id: input.toAccountId } })]);
  if (!from || !from.isActive) throw new FinanceError("validation", "Manba kassa topilmadi yoki faol emas");
  if (!to || !to.isActive) throw new FinanceError("validation", "Qabul qiluvchi kassa topilmadi yoki faol emas");
  assertBranchAccess(actor, from.branchId);
  assertBranchAccess(actor, to.branchId);
  await assertPeriodOpen(db, from.branchId, tashkentYearMonth(input.occurredAt));
  if (to.branchId !== from.branchId) await assertPeriodOpen(db, to.branchId, tashkentYearMonth(input.occurredAt)); // qabul qiluvchi filial oyi ham ochiq bo'lsin
  const balance = await accountBalance(db, from.id);
  if (balance < input.amount) {
    // Manfiy balansga ruxsat — faqat davr yopish huquqi bor rollar (DIRECTOR/DEPUTY/ACCOUNTANT) va sabab (izoh) bilan
    if (!input.allowNegative) throw new FinanceError("insufficient", "Manba kassada mablag' yetarli emas", { balance, requested: input.amount });
    if (!hasFinancePermission(actor.role, "FINANCE_PERIOD_CLOSE")) throw new FinanceError("forbidden", "Manfiy balansga o'tkazma uchun ruxsat yo'q");
    if (!input.note || input.note.trim().length < 3) throw new FinanceError("validation", "Manfiy balansga o'tkazma uchun izoh (sabab) kerak");
  }
  const transfer = await db.transfer.create({ data: { fromAccountId: from.id, toAccountId: to.id, amount: input.amount, occurredAt: input.occurredAt, note: input.note ?? null, idempotencyKey: input.idempotencyKey, createdById: actor.userId } });
  await postLedger(db, { accountId: from.id, branchId: from.branchId, type: "TRANSFER_OUT", direction: "OUT", amount: input.amount, referenceType: "Transfer", referenceId: transfer.id, occurredAt: input.occurredAt, actorId: actor.userId, note: input.note ?? `→ ${to.name}` });
  await postLedger(db, { accountId: to.id, branchId: to.branchId, type: "TRANSFER_IN", direction: "IN", amount: input.amount, referenceType: "Transfer", referenceId: transfer.id, occurredAt: input.occurredAt, actorId: actor.userId, note: input.note ?? `← ${from.name}` });
  await financeAudit(db, { actorId: actor.userId, action: "TRANSFER", entityType: "Transfer", entityId: transfer.id, newValue: { from: from.id, to: to.id, amount: input.amount, occurredAt: input.occurredAt.toISOString() }, reason: input.note ?? null });
  return { transfer, replayed: false };
}

export async function createTransfer(client: PrismaClient, input: TransferInput, actor: Pick<SessionUser, "userId" | "role" | "branchId">, now = new Date()) {
  requireFinancePermission(actor, "FINANCIAL_TRANSFER");
  return withFinanceTx(client, (tx) => createTransferTx(tx, input, actor, now));
}

/** Teskari o'tkazma: yangi Transfer (to → from) reversalOfId bilan; asl status REVERSED */
export async function reverseTransfer(client: PrismaClient, i: { transferId: string; reason: string; idempotencyKey: string }, actor: Pick<SessionUser, "userId" | "role" | "branchId">, now = new Date()): Promise<Transfer> {
  requireFinancePermission(actor, "FINANCIAL_TRANSFER");
  if (i.reason.trim().length < 3) throw new FinanceError("validation", "Sabab kamida 3 belgi");
  return withFinanceTx(client, async (tx) => {
    const orig = await tx.transfer.findUnique({ where: { id: i.transferId } });
    if (!orig) throw new FinanceError("not_found", "O'tkazma topilmadi");
    if (orig.status === "REVERSED" || orig.reversalOfId) throw new FinanceError("state", "O'tkazma allaqachon teskari qilingan yoki o'zi teskari");
    const { transfer, replayed } = await createTransferTx(tx, { fromAccountId: orig.toAccountId, toAccountId: orig.fromAccountId, amount: orig.amount, occurredAt: now, note: `Teskari: ${i.reason}`, idempotencyKey: i.idempotencyKey, allowNegative: true }, actor, now);
    if (replayed) {
      // Kalit boshqa (aloqasiz) o'tkazmaga tegishli bo'lsa — hech narsa o'zgartirmaymiz
      if (transfer.reversalOfId !== orig.id) throw new FinanceError("conflict", "idempotencyKey boshqa o'tkazmaga tegishli", { transferId: transfer.id });
      return transfer;
    }
    await tx.transfer.update({ where: { id: transfer.id }, data: { reversalOfId: orig.id } });
    await tx.transfer.update({ where: { id: orig.id }, data: { status: "REVERSED" } });
    await financeAudit(tx, { actorId: actor.userId, action: "REVERSE", entityType: "Transfer", entityId: orig.id, newValue: { reversalId: transfer.id }, reason: i.reason });
    return tx.transfer.findUniqueOrThrow({ where: { id: transfer.id } });
  });
}
