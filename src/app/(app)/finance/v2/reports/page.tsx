import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { monthRange, type SumRow } from "@/lib/finance/reports/common";
import { collections, collectionsTotal, refundsTotal, revenueBy } from "@/lib/finance/reports/collections";
import { cashFlow, profitAndLoss } from "@/lib/finance/reports/cashflow";
import { debtReport, studentBalancesReport } from "@/lib/finance/reports/debt";
import { expensesBy, expensesTotal } from "@/lib/finance/reports/expenses";
import { payoutsReport, salaryPeriodsReport, teacherEarningsReport, unpaidSalaryReport } from "@/lib/finance/reports/salary";
import { monthsBetween, monthStart, monthEnd, type YearMonth } from "@/lib/finance/period";
import { Card, EmptyRow, Forbidden, PageHeader, StatCard, Table } from "../../../_components/ui";
import { fin, type FinKey } from "../_i18n";
import { financePage, monthFromSearch } from "../_shared";
import MonthPicker from "../MonthPicker";

const TABS: { id: string; key: FinKey }[] = [
  { id: "collections", key: "payments" }, { id: "revenue", key: "revenue" }, { id: "expenses", key: "expenses" }, { id: "debt", key: "debtors" },
  { id: "balances", key: "balances" }, { id: "salary", key: "salary" }, { id: "cashflow", key: "cashFlow" }, { id: "pnl", key: "pnl" },
];

function SumTable({ title, rows, L }: { title: string; rows: SumRow[]; L: "uz" | "ru" | "en" | "de" }) {
  return (
    <Card padded={false}>
      <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800"><h3 className="text-sm font-semibold">{title}</h3></div>
      <Table head={<tr><th className="px-4 py-2 text-left">{fin(L, "name")}</th><th className="px-3 py-2 text-right">#</th><th className="px-3 py-2 text-right">{fin(L, "amount")}</th></tr>}>
        {rows.length === 0 ? <EmptyRow colSpan={3} text={fin(L, "empty")} /> : rows.map((r) => <tr key={r.key} className="text-sm"><td className="px-4 py-2">{r.label}</td><td className="px-3 py-2 text-right">{r.count}</td><td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(r.amount, L)}</td></tr>)}
      </Table>
    </Card>
  );
}

export default async function ReportsV2Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { session, branchId, can } = await financePage();
  const L = session.locale;
  if (!can("FINANCE_REPORT_VIEW")) return <Forbidden title={fin(L, "forbiddenTitle")} body={fin(L, "forbidden")} />;
  const { ym, key } = monthFromSearch(sp);
  const tab = typeof sp.tab === "string" && TABS.some((t) => t.id === sp.tab) ? sp.tab : "collections";
  const r = monthRange(ym, branchId);
  const year: YearMonth[] = monthsBetween({ year: ym.year, month: 1 }, { year: ym.year, month: 12 });
  let body: React.ReactNode = null;

  if (tab === "collections") {
    const [total, refunds, byMethod, byAccount, byDay, byBranch, yearly] = await Promise.all([collectionsTotal(prisma, r), refundsTotal(prisma, r), collections(prisma, r, "method"), collections(prisma, r, "account"), collections(prisma, r, "day"), collections(prisma, r, "branch"), collections(prisma, { from: monthStart(year[0]), to: monthEnd(year[11]), branchId }, "month")]);
    body = <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4"><StatCard label={fin(L, "monthCollected")} value={formatMoney(total.amount, L)} tone="green" /><StatCard label={fin(L, "refund")} value={formatMoney(refunds.amount, L)} tone="red" /><StatCard label={`${fin(L, "net")}`} value={formatMoney(total.amount - refunds.amount, L)} tone="brand" /><StatCard label="#" value={total.count} /></div>
      <div className="grid gap-4 md:grid-cols-2"><SumTable title={fin(L, "method")} rows={byMethod} L={L} /><SumTable title={fin(L, "account")} rows={byAccount} L={L} /><SumTable title={`${fin(L, "date")} (kun)`} rows={byDay} L={L} /><SumTable title="Filial" rows={byBranch} L={L} /><SumTable title={`${ym.year} — ${fin(L, "month")}`} rows={yearly} L={L} /></div>
    </>;
  } else if (tab === "revenue") {
    const [byProgram, byGroup, byTeacher] = await Promise.all([revenueBy(prisma, r, "program"), revenueBy(prisma, r, "group"), revenueBy(prisma, r, "teacher")]);
    body = <div className="grid gap-4 md:grid-cols-3"><SumTable title={fin(L, "course")} rows={byProgram} L={L} /><SumTable title={fin(L, "group")} rows={byGroup} L={L} /><SumTable title={fin(L, "teacher")} rows={byTeacher} L={L} /></div>;
  } else if (tab === "expenses") {
    const [total, byCat, byBranch, byAccount, byMonth] = await Promise.all([expensesTotal(prisma, r), expensesBy(prisma, r, "category"), expensesBy(prisma, r, "branch"), expensesBy(prisma, r, "account"), expensesBy(prisma, { from: monthStart(year[0]), to: monthEnd(year[11]), branchId }, "month")]);
    body = <><div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4"><StatCard label={fin(L, "monthExpenses")} value={formatMoney(total.amount, L)} tone="red" /><StatCard label="#" value={total.count} /></div><div className="grid gap-4 md:grid-cols-2"><SumTable title={fin(L, "category")} rows={byCat} L={L} /><SumTable title="Filial" rows={byBranch} L={L} /><SumTable title={fin(L, "account")} rows={byAccount} L={L} /><SumTable title={`${ym.year} — ${fin(L, "month")}`} rows={byMonth} L={L} /></div></>;
  } else if (tab === "debt") {
    const d = await debtReport(prisma, { branchId });
    body = <><div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">{(["current", "1-3", "4-7", "8-30", "30+"] as const).map((b) => <StatCard key={b} label={b} value={formatMoney(d.aging[b].amount, L)} tone={b === "30+" ? "red" : "amber"} />)}</div>
      <Card padded={false}><Table head={<tr><th className="px-4 py-2 text-left">{fin(L, "student")}</th><th className="px-3 py-2 text-right">{fin(L, "debt")}</th><th className="px-3 py-2 text-left">{fin(L, "aging")}</th></tr>}>{d.rows.length === 0 ? <EmptyRow colSpan={3} text={fin(L, "empty")} /> : d.rows.map((x) => <tr key={x.studentId} className="text-sm"><td className="px-4 py-2">{x.fullName}</td><td className="px-3 py-2 text-right tabular-nums text-red-600">{formatMoney(x.debt, L)}</td><td className="px-3 py-2">{x.bucket}</td></tr>)}</Table></Card></>;
  } else if (tab === "balances") {
    const rows = await studentBalancesReport(prisma, { branchId, onlyNonZero: true });
    body = <Card padded={false}><Table head={<tr><th className="px-4 py-2 text-left">{fin(L, "student")}</th><th className="px-3 py-2 text-right">{fin(L, "debt")}</th><th className="px-3 py-2 text-right">{fin(L, "credit")}</th><th className="px-3 py-2 text-right">{fin(L, "net")}</th></tr>}>{rows.length === 0 ? <EmptyRow colSpan={4} text={fin(L, "empty")} /> : rows.map((x) => <tr key={x.studentId} className="text-sm"><td className="px-4 py-2">{x.fullName}</td><td className="px-3 py-2 text-right tabular-nums">{formatMoney(x.debt, L)}</td><td className="px-3 py-2 text-right tabular-nums">{formatMoney(x.credit, L)}</td><td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(x.net, L)}</td></tr>)}</Table></Card>;
  } else if (tab === "salary") {
    const [earn, periods, unpaid, payouts] = await Promise.all([teacherEarningsReport(prisma, ym, branchId), salaryPeriodsReport(prisma, { ym }), unpaidSalaryReport(prisma), payoutsReport(prisma, r)]);
    body = <div className="grid gap-4 md:grid-cols-2">
      <Card padded={false}><div className="border-b px-5 py-3 text-sm font-semibold">{fin(L, "earning")} — {key}</div><Table head={<tr><th className="px-4 py-2 text-left">{fin(L, "teacher")}</th><th className="px-3 py-2 text-right">{fin(L, "earning")}</th><th className="px-3 py-2 text-right">{fin(L, "fixed")}</th><th className="px-3 py-2 text-right">{fin(L, "gross")}</th><th className="px-3 py-2 text-right">{fin(L, "needsReview")}</th></tr>}>{earn.length === 0 ? <EmptyRow colSpan={5} text={fin(L, "empty")} /> : earn.map((t) => <tr key={t.teacherId} className="text-sm"><td className="px-4 py-2">{t.teacherName}</td><td className="px-3 py-2 text-right tabular-nums">{formatMoney(t.commission + t.adjustment, L)}</td><td className="px-3 py-2 text-right tabular-nums">{formatMoney(t.fixed, L)}</td><td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(t.total, L)}</td><td className="px-3 py-2 text-right">{t.needsReview || ""}</td></tr>)}</Table></Card>
      <Card padded={false}><div className="border-b px-5 py-3 text-sm font-semibold">{fin(L, "period")} — {key}</div><Table head={<tr><th className="px-4 py-2 text-left">{fin(L, "teacher")}</th><th className="px-3 py-2 text-left">{fin(L, "status")}</th><th className="px-3 py-2 text-right">{fin(L, "gross")}</th><th className="px-3 py-2 text-right">{fin(L, "paid")}</th><th className="px-3 py-2 text-right">{fin(L, "remaining")}</th></tr>}>{periods.length === 0 ? <EmptyRow colSpan={5} text={fin(L, "empty")} /> : periods.map((p) => <tr key={p.periodId} className="text-sm"><td className="px-4 py-2"><Link className="text-brand-700 hover:underline" href={`/finance/v2/salary/${p.periodId}`}>{p.teacherName}</Link></td><td className="px-3 py-2">{p.status}</td><td className="px-3 py-2 text-right tabular-nums">{formatMoney(p.gross, L)}</td><td className="px-3 py-2 text-right tabular-nums">{formatMoney(p.paid, L)}</td><td className="px-3 py-2 text-right tabular-nums">{formatMoney(p.remaining, L)}</td></tr>)}</Table></Card>
      <Card><h3 className="mb-2 text-sm font-semibold">{fin(L, "salaryLiability")}: {formatMoney(unpaid.total, L)}</h3><ul className="space-y-1 text-sm">{unpaid.rows.map((u) => <li key={u.periodId} className="flex justify-between"><span>{u.teacherName} · {u.period}</span><span className="tabular-nums">{formatMoney(u.remaining, L)}</span></li>)}</ul></Card>
      <SumTable title={`${fin(L, "payout")} — ${formatMoney(payouts.total, L)}`} rows={payouts.byAccount} L={L} />
    </div>;
  } else if (tab === "cashflow") {
    const cf = await cashFlow(prisma, r);
    const inRows: SumRow[] = Object.entries(cf.inflowByType).map(([k, v]) => ({ key: k, label: k, amount: v, count: 0 }));
    const outRows: SumRow[] = Object.entries(cf.outflowByType).map(([k, v]) => ({ key: k, label: k, amount: v, count: 0 }));
    body = <><div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5"><StatCard label={fin(L, "opening")} value={formatMoney(cf.openingCash, L)} /><StatCard label={fin(L, "inflow")} value={formatMoney(cf.inflow, L)} tone="green" /><StatCard label={fin(L, "outflow")} value={formatMoney(cf.outflow, L)} tone="red" /><StatCard label={fin(L, "netCashFlow")} value={formatMoney(cf.net, L)} tone={cf.net >= 0 ? "green" : "red"} /><StatCard label={fin(L, "closing")} value={formatMoney(cf.closingCash, L)} tone="brand" /></div><div className="grid gap-4 md:grid-cols-2"><SumTable title={fin(L, "inflow")} rows={inRows} L={L} /><SumTable title={fin(L, "outflow")} rows={outRows} L={L} /></div></>;
  } else if (tab === "pnl") {
    const rows = await Promise.all(year.filter((m) => m.month <= ym.month).map((m) => profitAndLoss(prisma, m, branchId)));
    body = <Card padded={false}><Table head={<tr><th className="px-4 py-2 text-left">{fin(L, "month")}</th><th className="px-3 py-2 text-right">{fin(L, "revenue")} (accrual)</th><th className="px-3 py-2 text-right">{fin(L, "expenses")}</th><th className="px-3 py-2 text-right">{fin(L, "salary")} (accrual)</th><th className="px-3 py-2 text-right">{fin(L, "profit")}</th><th className="px-3 py-2 text-right">{fin(L, "netCashFlow")} (cash)</th></tr>}>
      {rows.map((p) => <tr key={p.month.month} className="text-sm"><td className="px-4 py-2">{p.month.year}-{String(p.month.month).padStart(2, "0")}</td><td className="px-3 py-2 text-right tabular-nums">{formatMoney(p.revenue, L)}</td><td className="px-3 py-2 text-right tabular-nums text-red-600">{formatMoney(p.expenses, L)}</td><td className="px-3 py-2 text-right tabular-nums text-red-600">{formatMoney(p.salaryAccrued, L)}</td><td className={cn("px-3 py-2 text-right tabular-nums font-semibold", p.profit < 0 ? "text-red-600" : "text-emerald-600")}>{formatMoney(p.profit, L)}</td><td className="px-3 py-2 text-right tabular-nums">{formatMoney(p.cashNet, L)}</td></tr>)}
    </Table></Card>;
  }
  return (
    <>
      <PageHeader title={fin(L, "reports")} subtitle={key} action={<MonthPicker value={key} />} />
      <div className="mb-4 flex flex-wrap gap-1">{TABS.map((t) => <Link key={t.id} href={`/finance/v2/reports?tab=${t.id}&ym=${key}`} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", tab === t.id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300")}>{fin(L, t.key)}</Link>)}</div>
      {body}
    </>
  );
}
