import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/constants";
import { accountStatement } from "@/lib/finance/accounts/balances";
import { monthEnd, monthStart } from "@/lib/finance/period";
import { assertBranchAccess } from "@/lib/finance/permissions";
import { Badge, Card, EmptyRow, Forbidden, PageHeader, StatCard, Table } from "../../../../_components/ui";
import { fin, fmtDate } from "../../_i18n";
import { financePage, monthFromSearch } from "../../_shared";
import MonthPicker from "../../MonthPicker";

export default async function AccountStatementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const { session, can } = await financePage();
  const L = session.locale;
  if (!can("FINANCIAL_ACCOUNT_VIEW")) return <Forbidden title={fin(L, "forbiddenTitle")} body={fin(L, "forbidden")} />;
  const account = await prisma.financialAccount.findUnique({ where: { id } });
  if (!account) notFound();
  try { assertBranchAccess(session, account.branchId); } catch { return <Forbidden title={fin(L, "forbiddenTitle")} body={fin(L, "forbidden")} />; }
  const { ym, key } = monthFromSearch(await searchParams);
  const st = await accountStatement(prisma, id, monthStart(ym), monthEnd(ym));
  return (
    <>
      <PageHeader title={`${account.name} · ${account.type}`} subtitle={key} action={<MonthPicker value={key} />} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={fin(L, "opening")} value={formatMoney(st.opening, L)} />
        <StatCard label={fin(L, "inflow")} value={formatMoney(st.inflow, L)} tone="green" />
        <StatCard label={fin(L, "outflow")} value={formatMoney(st.outflow, L)} tone="red" />
        <StatCard label={fin(L, "closing")} value={formatMoney(st.closing, L)} tone="brand" />
      </div>
      <Card padded={false}>
        <Table head={<tr><th className="px-4 py-3 text-left">{fin(L, "date")}</th><th className="px-3 py-3 text-left">{fin(L, "type")}</th><th className="px-3 py-3 text-right">{fin(L, "inflow")}</th><th className="px-3 py-3 text-right">{fin(L, "outflow")}</th><th className="px-3 py-3 text-right">{fin(L, "net")}</th><th className="px-3 py-3 text-left">{fin(L, "note")}</th></tr>}>
          {st.lines.length === 0 ? <EmptyRow colSpan={6} text={fin(L, "empty")} /> : st.lines.map((l) => (
            <tr key={l.tx.id} className="text-sm">
              <td className="px-4 py-2.5 text-slate-500">{fmtDate(L, l.tx.occurredAt, true)}</td>
              <td className="px-3 py-2.5"><Badge tone={l.tx.direction === "IN" ? "green" : "red"}>{l.tx.type}</Badge></td>
              <td className="px-3 py-2.5 text-right tabular-nums">{l.tx.direction === "IN" ? formatMoney(l.tx.amount, L) : ""}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{l.tx.direction === "OUT" ? formatMoney(l.tx.amount, L) : ""}</td>
              <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{formatMoney(l.running, L)}</td>
              <td className="px-3 py-2.5 text-slate-500">{l.tx.note ?? ""} <span className="text-[11px] text-slate-400">{l.tx.referenceType}</span></td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
