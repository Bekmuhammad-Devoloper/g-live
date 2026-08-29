import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, canWrite, MODULES } from "@/lib/rbac";
import { tr } from "@/lib/tr";
import { branchWhere } from "@/lib/branchScope";
import { Forbidden } from "../../_components/ui";
import LicenseBanner from "../../_components/LicenseBanner";
import ExpensesView, { type VExpense } from "./ExpensesView";

const p2 = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// "Xarajatlar" — moliya xarajatlari: statistika + grafik + kiritish formasi + filtrlar + jadval.
export default async function ExpensesPage() {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.EXPENSES)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsatingiz yo'q.", ru: "У вас нет доступа к этому разделу.", en: "You do not have permission for this section.", de: "Sie haben keine Berechtigung für diesen Bereich." })} />;
  }

  const [rows, categories] = await Promise.all([
    prisma.expense.findMany({
      where: branchWhere(s), // faol filial doirasida
      orderBy: { date: "desc" },
      include: {
        category: { select: { name: true } },
        author: { select: { fullName: true } },
      },
    }),
    prisma.expenseCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const expenses: VExpense[] = rows.map((e) => ({
    id: e.id,
    date: e.date.toISOString(),
    category: e.category?.name ?? null,
    name: e.name,
    recipient: e.recipient ?? null,
    method: e.method,
    amount: e.amount,
    author: e.author?.fullName ?? null,
  }));

  const staff = [...new Set(expenses.map((e) => e.author).filter((x): x is string => !!x))].sort();

  const now = new Date();
  const from = iso(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  return (
    <div>
      <LicenseBanner />
      <ExpensesView
        expenses={expenses}
        categories={categories}
        staff={staff}
        writable={canWrite(s.role, MODULES.EXPENSES)}
        locale={s.locale}
        defaultFrom={from}
        defaultTo={to}
        today={iso(now)}
      />
    </div>
  );
}
