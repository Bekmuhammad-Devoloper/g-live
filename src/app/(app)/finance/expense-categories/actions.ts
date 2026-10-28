"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canWrite, MODULES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

export type CatResult = { ok?: boolean; error?: "forbidden" | "invalid" | "duplicate" | "notfound" };

const refresh = () => {
  revalidatePath("/finance/expense-categories");
  revalidatePath("/finance/expenses");
};

export async function createExpenseCategory(name: string): Promise<CatResult> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.EXPENSES)) return { error: "forbidden" };
  const clean = String(name ?? "").trim().slice(0, 100);
  if (clean.length < 2) return { error: "invalid" };

  const exists = await prisma.expenseCategory.findUnique({ where: { name: clean } });
  if (exists) return { error: "duplicate" };

  const c = await prisma.expenseCategory.create({ data: { name: clean } });
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "ExpenseCategory", entityId: c.id, newValue: { name: clean }, reason: "Xarajat toifasi qo'shildi" });
  refresh();
  return { ok: true };
}

export async function renameExpenseCategory(id: string, name: string): Promise<CatResult> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.EXPENSES)) return { error: "forbidden" };
  const clean = String(name ?? "").trim().slice(0, 100);
  if (clean.length < 2) return { error: "invalid" };

  const before = await prisma.expenseCategory.findUnique({ where: { id } });
  if (!before) return { error: "notfound" };
  if (before.name === clean) return { ok: true };

  const dup = await prisma.expenseCategory.findUnique({ where: { name: clean } });
  if (dup && dup.id !== id) return { error: "duplicate" };

  await prisma.expenseCategory.update({ where: { id }, data: { name: clean } });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "ExpenseCategory", entityId: id, oldValue: { name: before.name }, newValue: { name: clean }, reason: "Xarajat toifasi tahrirlandi" });
  refresh();
  return { ok: true };
}

export async function deleteExpenseCategory(id: string): Promise<CatResult> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.EXPENSES)) return { error: "forbidden" };

  const before = await prisma.expenseCategory.findUnique({ where: { id }, include: { _count: { select: { expenses: true } } } });
  if (!before) return { error: "notfound" };

  await prisma.expenseCategory.delete({ where: { id } });
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "ExpenseCategory", entityId: id, oldValue: { name: before.name, expenses: before._count.expenses }, reason: "Xarajat toifasi o'chirildi" });
  refresh();
  return { ok: true };
}
