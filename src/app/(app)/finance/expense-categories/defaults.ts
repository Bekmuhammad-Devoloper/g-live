import { prisma } from "@/lib/db";

// Standart xarajat toifalari — jadval bo'sh bo'lsa bir marta yaratiladi
export const DEFAULT_EXPENSE_CATEGORIES = [
  "Boshqalar",
  "Ma'muriy xarajatlar",
  "Binolarni ijaraga to'lov",
  "Oylik",
  "Marketing",
  "Idora",
  "Uy xarajatlari",
  "Jihozlar",
  "Soliqlar",
  "Investitsiyalar",
  "To'lovni qaytarish",
];

export async function ensureDefaultExpenseCategories(): Promise<void> {
  const count = await prisma.expenseCategory.count();
  if (count > 0) return;
  try {
    await prisma.expenseCategory.createMany({ data: DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ name })) });
  } catch {
    // parallel so'rov allaqachon yaratgan bo'lsa (unique name) — e'tiborsiz
  }
}
