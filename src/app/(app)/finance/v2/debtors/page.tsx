import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/constants";
import { debtReport } from "@/lib/finance/reports/debt";
import { Badge, Card, EmptyRow, Forbidden, PageHeader, StatCard, Table } from "../../../_components/ui";
import { fin, fmtDate } from "../_i18n";
import { financePage } from "../_shared";
import SyncBillingButton from "./SyncBillingButton";

export default async function DebtorsV2Page() {
  const { session, branchId, can, flags } = await financePage();
  const L = session.locale;
  if (!can("FINANCE_VIEW")) return <Forbidden title={fin(L, "forbiddenTitle")} body={fin(L, "forbidden")} />;
  const r = await debtReport(prisma, { branchId });
  const buckets = ["current", "1-3", "4-7", "8-30", "30+"] as const;
  return (
    <>
      <PageHeader title={fin(L, "debtors")} subtitle={`${fin(L, "outstandingDebt")}: ${formatMoney(r.total, L)}`} action={flags.enabled ? <SyncBillingButton locale={L} /> : undefined} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {buckets.map((b) => <StatCard key={b} label={`${fin(L, "aging")} ${b}`} value={formatMoney(r.aging[b].amount, L)} tone={b === "30+" ? "red" : b === "current" ? "default" : "amber"} />)}
      </div>
      <Card padded={false}>
        <Table head={<tr><th className="px-4 py-3 text-left">{fin(L, "student")}</th><th className="px-3 py-3 text-right">{fin(L, "debt")}</th><th className="px-3 py-3 text-left">{fin(L, "date")}</th><th className="px-3 py-3 text-left">{fin(L, "aging")}</th></tr>}>
          {r.rows.length === 0 ? <EmptyRow colSpan={4} text={fin(L, "empty")} /> : r.rows.map((x) => (
            <tr key={x.studentId} className="text-sm">
              <td className="px-4 py-2.5"><a className="font-medium text-brand-700 hover:underline" href={`/students/${x.studentId}`}>{x.fullName}</a><div className="text-[11px] text-slate-400">{x.phone ?? ""} · {x.openCount}</div></td>
              <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-red-600">{formatMoney(x.debt, L)}</td>
              <td className="px-3 py-2.5 text-slate-500">{fmtDate(L, x.oldestDueDate)}</td>
              <td className="px-3 py-2.5"><Badge tone={x.bucket === "30+" ? "red" : x.bucket === "current" ? "slate" : "amber"}>{x.bucket ?? "—"}</Badge></td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
