"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAX_MONEY } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canWrite, MODULES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { financeV2Enabled, legacyCreateExpense } from "@/lib/finance/legacyAdapter";

export type ExState = { ok?: boolean; error?: string };

const schema = z.object({
  name: z.string().min(1),
  date: z.string().min(1),
  amount: z.coerce.number().int().positive().max(MAX_MONEY), // Int'ga sig'masa sahifa yiqiladi (2026-09-11)
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

  // Finance V2 yoqilgan bo'lsa — ledger OUT bilan V2 xarajat
  if (await financeV2Enabled()) {
    const v2 = await legacyCreateExpense(s, { name: parsed.data.name, amount: parsed.data.amount, date: new Date(parsed.data.date), method: parsed.data.method, categoryId: parsed.data.categoryId ?? null, recipient: parsed.data.recipient ?? null, note: parsed.data.note ?? null, branchId: s.branchId ?? null });
    if (!v2.ok) return { error: v2.error === "forbidden" ? "forbidden" : "invalid" };
    revalidatePath("/finance/expenses");
    return { ok: true };
  }

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
  // Finance V2: ledgerga kiritilgan (postedAt) xarajat jismoniy O'CHIRILMAYDI — tuzatish faqat teskari qator (reverseExpense)
  if (before.postedAt) return;

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
