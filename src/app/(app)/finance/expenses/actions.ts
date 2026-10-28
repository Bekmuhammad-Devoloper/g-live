"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAX_MONEY } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canWrite, MODULES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { branchWhere } from "@/lib/branchScope";

export type ExState = { ok?: boolean; error?: string };

const schema = z.object({
  name: z.string().min(1),
  date: z.string().min(1),
  amount: z.coerce.number().int().positive().max(MAX_MONEY),
  method: z.string().min(1),
  categoryId: z.string().optional(),
  recipient: z.string().optional(),
  note: z.string().optional(),
});

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
      branchId: s.branchId,
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
  revalidatePath("/finance/expense-categories");
  return { ok: true };
}

export async function updateExpense(_prev: ExState, formData: FormData): Promise<ExState> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.EXPENSES)) return { error: "forbidden" };

  const id = String(formData.get("id") ?? "");
  const parsed = schema.safeParse({
    name: formData.get("name"),
    date: formData.get("date"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    categoryId: formData.get("categoryId") || undefined,
    recipient: formData.get("recipient") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!id || !parsed.success) return { error: "invalid" };

  const before = await prisma.expense.findFirst({ where: { id, ...branchWhere(s) } });
  if (!before) return { error: "notfound" };

  const d = parsed.data;
  const after = await prisma.expense.update({
    where: { id },
    data: {
      name: d.name,
      date: new Date(d.date),
      amount: d.amount,
      method: d.method,
      categoryId: d.categoryId ?? null,
      recipient: d.recipient ?? null,
      note: d.note ?? null,
    },
  });

  const pick = (e: typeof before) => ({
    name: e.name, date: e.date.toISOString().slice(0, 10), amount: e.amount, method: e.method,
    categoryId: e.categoryId, recipient: e.recipient, note: e.note,
  });
  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "Expense",
    entityId: id,
    oldValue: pick(before),
    newValue: pick(after),
    reason: "Xarajat tahrirlandi",
  });

  revalidatePath("/finance/expenses");
  revalidatePath("/finance/expense-categories");
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<void> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.EXPENSES)) return;

  const before = await prisma.expense.findFirst({ where: { id, ...branchWhere(s) } });
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
  revalidatePath("/finance/expense-categories");
}
