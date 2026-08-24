"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canWrite, MODULES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

export type ExState = { ok?: boolean; error?: string };

const schema = z.object({
  name: z.string().min(1),
  date: z.string().min(1),
  amount: z.coerce.number().int().positive(),
  method: z.string().min(1),
  categoryId: z.string().optional(),
  recipient: z.string().optional(),
  note: z.string().optional(),
});

// Yangi xarajat kiritish
export async function createExpense(_prev: ExState, formData: FormData): Promise<ExState> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.EXPENSES)) return { error: "forbidden" };

  const parsed = schema.safeParse({
    name: formData.get("name"),
    date: formData.get("date"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    categoryId: formData.get("categoryId") || undefined,
    recipient: formData.get("recipient") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  const exp = await prisma.expense.create({
    data: {
      name: parsed.data.name,
      date: new Date(parsed.data.date),
      amount: parsed.data.amount,
      method: parsed.data.method,
      categoryId: parsed.data.categoryId,
      recipient: parsed.data.recipient,
      note: parsed.data.note,
      authorId: s.userId,
      branchId: s.branchId, // xarajat qaysi filialda kiritilgan bo'lsa — o'shanga biriktiriladi
    },
  });

  await writeAudit({
    actorId: s.userId,
    action: "CREATE",
    entityType: "Expense",
    entityId: exp.id,
    newValue: { name: exp.name, amount: exp.amount, method: exp.method },
    reason: "Xarajat kiritildi",
  });

  revalidatePath("/finance/expenses");
  return { ok: true };
}

// Yangi turkum (kategoriya) qo'shish
export async function addExpenseCategory(name: string): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.EXPENSES)) return { error: "forbidden" };
  const clean = name.trim();
  if (clean.length < 2) return { error: "invalid" };

  const exists = await prisma.expenseCategory.findUnique({ where: { name: clean } });
  if (exists) return { error: "duplicate" };

  await prisma.expenseCategory.create({ data: { name: clean } });
  revalidatePath("/finance/expenses");
  return { ok: true };
}

// Xarajatni o'chirish (audit bilan)
export async function deleteExpense(id: string): Promise<void> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.EXPENSES)) return;

  const before = await prisma.expense.findUnique({ where: { id } });
  if (!before) return;

  await prisma.expense.delete({ where: { id } });

  await writeAudit({
    actorId: s.userId,
    action: "DELETE",
    entityType: "Expense",
    entityId: id,
    oldValue: { name: before.name, amount: before.amount },
    reason: "Xarajat o'chirildi",
  });

  revalidatePath("/finance/expenses");
}
