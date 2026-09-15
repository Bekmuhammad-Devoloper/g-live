import { prisma } from "@/lib/db";
import { PAYMENT_METHODS, formatMoney } from "@/lib/constants";
import { monthEnd, monthStart } from "@/lib/finance/period";
import { expensesTotal } from "@/lib/finance/reports/expenses";
import { Forbidden, PageHeader } from "../../../_components/ui";
import { fin } from "../_i18n";
import { financePage, monthFromSearch } from "../_shared";
import MonthPicker from "../MonthPicker";
import ExpensesV2View from "./ExpensesV2View";

export default async function ExpensesV2Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { session, branchId, can, flags } = await financePage();
  const L = session.locale;
  if (!can("EXPENSE_VIEW")) return <Forbidden title={fin(L, "forbiddenTitle")} body={fin(L, "forbidden")} />;
  const { ym, key } = monthFromSearch(await searchParams);
  const range = { from: monthStart(ym), to: monthEnd(ym), branchId };
  const [rows, categories, accounts, total] = await Promise.all([
    prisma.expense.findMany({ where: { date: { gte: range.from, lt: range.to }, ...(branchId ? { branchId } : {}) }, orderBy: { date: "desc" }, include: { category: { select: { name: true } }, financialAccount: { select: { name: true } } } }),
    prisma.expenseCategory.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.financialAccount.findMany({ where: { isActive: true, ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    expensesTotal(prisma, range),
  ]);
  return (
    <>
      <PageHeader title={fin(L, "expenses")} subtitle={`${key}: ${formatMoney(total.amount, L)}`} action={<MonthPicker value={key} />} />
      <ExpensesV2View locale={L} canCreate={can("EXPENSE_CREATE") && flags.enabled} canCorrect={can("EXPENSE_CORRECT") && flags.enabled} categories={categories} accounts={accounts} methods={[...PAYMENT_METHODS, "HUMO"]}
        rows={rows.map((e) => ({ id: e.id, name: e.name, amount: e.amount, date: e.date.toISOString(), method: e.method, category: e.category?.name ?? null, account: e.financialAccount?.name ?? null, recipient: e.recipient, status: e.status, posted: !!e.postedAt, reversal: !!e.reversalOfId, note: e.note }))} />
    </>
  );
}
