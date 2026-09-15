// Finance V2 — xarajatlar (Phase 10). Xarajat = ledger OUT (kassadan chiqim).
// Hard delete YO'Q: tuzatish = teskari qator (reversalOfId, ledger IN) + yangi
// to'g'ri xarajat. Legacy Expense qatorlari saqlanadi; backfill ularni V2 ga
// (kassa, postedAt, ledger OUT) kiritadi.

import type { Expense, PrismaClient } from "@prisma/client";
import { z } from "zod";

import { MAX_MONEY, PAYMENT_METHODS } from "@/lib/constants";
import type { SessionUser } from "@/lib/auth";
import { withFinanceTx, type FinanceDb } from "../db";
import { FinanceError } from "../errors";
import { financeAudit } from "../audit";
import { assertBranchAccess, branchScope, requireFinancePermission } from "../permissions";
import { accountForMethod } from "../accounts/accounts";
import { postLedger } from "../ledger/post";
import { tashkentYearMonth } from "../period";
import { assertPeriodOpen } from "../payments/periodLock";

const KNOWN_METHODS = new Set<string>([...PAYMENT_METHODS, "HUMO"]);

/** Legacy usul matnini normalizatsiya qiladi; noma'lum → CASH (asl qiymat methodRaw da) */
export function normalizeExpenseMethod(raw: string | null | undefined): { method: string; methodRaw: string | null } {
  const up = String(raw ?? "").trim().toUpperCase();
  if (KNOWN_METHODS.has(up)) return { method: up, methodRaw: up === raw ? null : raw ?? null };
  return { method: "CASH", methodRaw: raw ?? null };
}

export const expenseSchema = z.object({
  name: z.string().trim().min(2).max(200),
  amount: z.number().int().positive().max(MAX_MONEY),
  date: z.coerce.date(),
  method: z.string().trim().min(1).max(32),
  categoryId: z.string().min(1).optional().nullable(),
  financialAccountId: z.string().min(1).optional(),
  branchId: z.string().min(1).optional().nullable(),
  recipient: z.string().trim().max(200).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  receiptUrl: z.string().trim().max(2000).optional().nullable(),
  idempotencyKey: z.string().min(8).max(128),
});
export type ExpenseInput = z.input<typeof expenseSchema>;

export async function createExpenseTx(db: FinanceDb, raw: ExpenseInput, actor: Pick<SessionUser, "userId" | "role" | "branchId">, now = new Date()): Promise<{ expense: Expense; replayed: boolean }> {
  const input = expenseSchema.parse(raw);
  const replay = await db.expense.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (replay) return { expense: replay, replayed: true };
  if (input.date.getTime() > now.getTime() + 24 * 60 * 60 * 1000) throw new FinanceError("validation", "Xarajat sanasi kelajakda bo'lishi mumkin emas");
  // Filial: MANAGER → o'z filiali (input e'tiborsiz), boshqalar → input yoki null
  const scope = branchScope(actor);
  const branchId = scope ? scope.branchId || null : input.branchId ?? null;
  if (scope && !branchId) throw new FinanceError("forbidden", "Filial aniqlanmadi");
  await assertPeriodOpen(db, branchId, tashkentYearMonth(input.date));
  if (input.categoryId) {
    const cat = await db.expenseCategory.findUnique({ where: { id: input.categoryId } });
    if (!cat) throw new FinanceError("validation", "Kategoriya topilmadi");
  }
  const { method, methodRaw } = normalizeExpenseMethod(input.method);
  const account = input.financialAccountId ? await db.financialAccount.findUnique({ where: { id: input.financialAccountId } }) : await accountForMethod(db, branchId, method, actor.userId);
  if (!account || !account.isActive) throw new FinanceError("validation", "Kassa topilmadi yoki faol emas");
  assertBranchAccess(actor, account.branchId ?? branchId);
  const expense = await db.expense.create({
    data: {
      name: input.name, amount: input.amount, date: input.date, method, methodRaw, categoryId: input.categoryId ?? null, branchId, recipient: input.recipient ?? null,
      note: input.note ?? null, receiptUrl: input.receiptUrl ?? null, authorId: actor.userId, financialAccountId: account.id, status: "ACTIVE", postedAt: now, idempotencyKey: input.idempotencyKey,
    },
  });
  await postLedger(db, { accountId: account.id, branchId: account.branchId ?? branchId, type: "EXPENSE", direction: "OUT", amount: input.amount, referenceType: "Expense", referenceId: expense.id, occurredAt: input.date, actorId: actor.userId, note: input.name });
  await financeAudit(db, { actorId: actor.userId, action: "CREATE", entityType: "Expense", entityId: expense.id, newValue: { name: input.name, amount: input.amount, date: input.date.toISOString(), accountId: account.id, categoryId: input.categoryId ?? null, branchId }, reason: input.note ?? null });
  return { expense, replayed: false };
}

export async function createExpense(client: PrismaClient, input: ExpenseInput, actor: Pick<SessionUser, "userId" | "role" | "branchId">, now = new Date()) {
  requireFinancePermission(actor, "EXPENSE_CREATE");
  return withFinanceTx(client, (tx) => createExpenseTx(tx, input, actor, now));
}

export interface ReverseExpenseInput {
  expenseId: string;
  reason: string;
  idempotencyKey: string;
  /** to'g'ri xarajat (bo'lmasa faqat bekor qilinadi) */
  replacement?: Omit<ExpenseInput, "idempotencyKey" | "branchId"> | null;
}

/** Correction: teskari qator (ledger IN) + asl REVERSED + (ixtiyoriy) yangi xarajat. Asl qator o'chirilmaydi. */
export async function reverseExpense(client: PrismaClient, i: ReverseExpenseInput, actor: Pick<SessionUser, "userId" | "role" | "branchId">, now = new Date()): Promise<{ reversal: Expense; original: Expense; replacement: Expense | null }> {
  requireFinancePermission(actor, "EXPENSE_CORRECT");
  if (i.reason.trim().length < 3) throw new FinanceError("validation", "Sabab kamida 3 belgi");
  return withFinanceTx(client, async (tx) => {
    const orig = await tx.expense.findUnique({ where: { id: i.expenseId } });
    if (!orig) throw new FinanceError("not_found", "Xarajat topilmadi");
    if (!orig.postedAt || !orig.financialAccountId) throw new FinanceError("state", "Faqat V2 ga kiritilgan xarajat teskari qilinadi (legacy — backfill'dan keyin)");
    if (orig.status === "REVERSED" || orig.reversalOfId) throw new FinanceError("state", "Xarajat allaqachon teskari qilingan yoki o'zi teskari");
    assertBranchAccess(actor, orig.branchId);
    await assertPeriodOpen(tx, orig.branchId, tashkentYearMonth(now));
    const existing = await tx.expense.findUnique({ where: { idempotencyKey: i.idempotencyKey } });
    if (existing) return { reversal: existing, original: orig, replacement: null };
    const reversal = await tx.expense.create({
      data: {
        name: `Teskari: ${orig.name}`, amount: orig.amount, date: now, method: orig.method, categoryId: orig.categoryId, branchId: orig.branchId, recipient: orig.recipient,
        note: i.reason.trim(), authorId: actor.userId, financialAccountId: orig.financialAccountId, status: "ACTIVE", postedAt: now, reversalOfId: orig.id, idempotencyKey: i.idempotencyKey,
      },
    });
    await postLedger(tx, { accountId: orig.financialAccountId, branchId: orig.branchId, type: "EXPENSE", direction: "IN", amount: orig.amount, referenceType: "Expense", referenceId: reversal.id, occurredAt: now, actorId: actor.userId, note: `Teskari: ${orig.name}` });
    const original = await tx.expense.update({ where: { id: orig.id }, data: { status: "REVERSED" } });
    let replacement: Expense | null = null;
    if (i.replacement) {
      replacement = (await createExpenseTx(tx, { ...i.replacement, branchId: orig.branchId, idempotencyKey: `${i.idempotencyKey}:replacement` }, actor, now)).expense;
    }
    await financeAudit(tx, { actorId: actor.userId, action: "REVERSE", entityType: "Expense", entityId: orig.id, oldValue: { status: "ACTIVE", amount: orig.amount }, newValue: { status: "REVERSED", reversalId: reversal.id, replacementId: replacement?.id ?? null }, reason: i.reason });
    return { reversal, original, replacement };
  });
}

