import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/constants";
import { financeDashboard } from "@/lib/finance/reports/dashboard";
import { unpaidSalaryReport } from "@/lib/finance/reports/salary";
import { Card, PageHeader, StatCard, Table, EmptyRow, Badge } from "../../_components/ui";
import { fin, fmtDate } from "./_i18n";
import { financePage } from "./_shared";

// Finance V2 — dashboard: har ko'rsatkich alohida tushuncha (S19: Cash Flow ≠ P&L).
export default async function FinanceV2Dashboard() {
  const { session, flags, branchId, can } = await financePage();
  const L = session.locale;
  if (!can("FINANCE_VIEW")) return null;
  const d = await financeDashboard(prisma, { branchId });
  const unpaid = can("SALARY_VIEW") ? await unpaidSalaryReport(prisma) : null;
  const recent = await prisma.payment.findMany({ where: { status: "PAID", legacyRole: null, postedAt: { not: null }, ...(branchId ? { branchId } : {}) }, orderBy: { receivedAt: "desc" }, take: 8, include: { student: { select: { fullName: true } }, financialAccount: { select: { name: true } } } });
  return (
    <>
      <PageHeader title={fin(L, "finance")} subtitle={flags.enabled ? undefined : fin(L, "disabled")} />
      {!flags.enabled && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{fin(L, "disabled")}</div>}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={fin(L, "todayCollected")} value={formatMoney(d.todayCollected, L)} tone="green" icon="wallet" />
        <StatCard label={fin(L, "monthCollected")} value={formatMoney(d.monthCollected, L)} tone="brand" icon="chart" />
        <StatCard label={fin(L, "expectedRevenue")} value={formatMoney(d.expectedRevenue, L)} icon="calendar" />
        <StatCard label={fin(L, "outstandingDebt")} value={formatMoney(d.outstandingDebt, L)} tone="red" icon="alert" />
        <StatCard label={fin(L, "studentCredit")} value={formatMoney(d.studentCredit, L)} tone="amber" icon="coins" />
        <StatCard label={fin(L, "monthExpenses")} value={formatMoney(d.monthExpenses, L)} tone="red" icon="trendDown" />
        <StatCard label={fin(L, "salaryLiability")} value={formatMoney(d.salaryLiability, L)} tone="amber" icon="teacher" />
        <StatCard label={fin(L, "salaryPaid")} value={formatMoney(d.monthSalaryPaid, L)} icon="check" />
        <StatCard label={fin(L, "cashBalance")} value={formatMoney(d.cashBalance, L)} tone="brand" icon="wallet" />
        <StatCard label={fin(L, "netCashFlow")} value={formatMoney(d.netCashFlow, L)} tone={d.netCashFlow >= 0 ? "green" : "red"} icon="trendUp" />
        <StatCard label={fin(L, "profit")} value={formatMoney(d.pnl.profit, L)} tone={d.pnl.profit >= 0 ? "green" : "red"} icon="dollar" />
        <StatCard label={fin(L, "revenue")} value={formatMoney(d.pnl.revenue, L)} icon="layers" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card padded={false} className="xl:col-span-2">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800"><h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{fin(L, "payments")}</h3></div>
          <Table head={<tr><th className="px-5 py-3 text-left">{fin(L, "student")}</th><th className="px-3 py-3 text-right">{fin(L, "amount")}</th><th className="px-3 py-3 text-left">{fin(L, "method")}</th><th className="px-3 py-3 text-left">{fin(L, "account")}</th><th className="px-3 py-3 text-left">{fin(L, "receivedAt")}</th></tr>}>
            {recent.length === 0 ? <EmptyRow colSpan={5} text={fin(L, "empty")} /> : recent.map((p) => (
              <tr key={p.id} className="text-sm">
                <td className="px-5 py-2.5 font-medium text-slate-800 dark:text-slate-100">{p.student.fullName}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(p.amount, L)}</td>
                <td className="px-3 py-2.5"><Badge tone="slate">{p.method}</Badge></td>
                <td className="px-3 py-2.5 text-slate-500">{p.financialAccount?.name ?? "—"}</td>
                <td className="px-3 py-2.5 text-slate-500">{fmtDate(L, p.receivedAt, true)}</td>
              </tr>
            ))}
          </Table>
        </Card>
        {unpaid && (
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{fin(L, "salaryLiability")}</h3>
            {unpaid.rows.length === 0 ? <p className="text-sm text-slate-500">{fin(L, "empty")}</p> : (
              <ul className="space-y-2 text-sm">
                {unpaid.rows.slice(0, 8).map((r) => (
                  <li key={r.periodId} className="flex items-center justify-between gap-2"><span className="truncate">{r.teacherName} · {r.period}</span><span className="tabular-nums font-semibold">{formatMoney(r.remaining, L)}</span></li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
