import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, canWrite, MODULES } from "@/lib/rbac";
import { tr } from "@/lib/tr";
import { branchWhere } from "@/lib/branchScope";
import { Forbidden } from "../../_components/ui";
import { ensureDefaultExpenseCategories } from "./defaults";
import ExpenseCategoriesView, { type VCategory } from "./ExpenseCategoriesView";

export default async function ExpenseCategoriesPage() {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.EXPENSES)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsatingiz yo'q.", ru: "У вас нет доступа к этому разделу.", en: "You do not have permission for this section.", de: "Sie haben keine Berechtigung für diesen Bereich." })} />;
  }

  await ensureDefaultExpenseCategories();

  const [cats, stats] = await Promise.all([
    prisma.expenseCategory.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, _count: { select: { expenses: true } } },
    }),
    prisma.expense.groupBy({
      by: ["categoryId"],
      where: { ...branchWhere(s), categoryId: { not: null } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  const byCat = new Map(stats.map((r) => [r.categoryId, r]));
  const categories: VCategory[] = cats.map((c) => ({
    id: c.id,
    name: c.name,
    count: byCat.get(c.id)?._count._all ?? 0,
    sum: byCat.get(c.id)?._sum.amount ?? 0,
    refs: c._count.expenses,
  }));

  return <ExpenseCategoriesView categories={categories} writable={canWrite(s.role, MODULES.EXPENSES)} locale={s.locale} />;
}
