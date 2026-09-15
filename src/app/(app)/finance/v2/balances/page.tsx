import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/constants";
import { studentBalancesReport } from "@/lib/finance/reports/debt";
import { Card, EmptyRow, Forbidden, PageHeader, Table } from "../../../_components/ui";
import { fin } from "../_i18n";
import { financePage } from "../_shared";

export default async function BalancesV2Page() {
  const { session, branchId, can } = await financePage();
  const L = session.locale;
  if (!can("FINANCE_VIEW")) return <Forbidden title={fin(L, "forbiddenTitle")} body={fin(L, "forbidden")} />;
  const rows = await studentBalancesReport(prisma, { branchId, onlyNonZero: true });
  const totalDebt = rows.reduce((a, r) => a + r.debt, 0);
  const totalCredit = rows.reduce((a, r) => a + r.credit, 0);
  return (
    <>
      <PageHeader title={fin(L, "balances")} subtitle={`${fin(L, "debt")}: ${formatMoney(totalDebt, L)} · ${fin(L, "credit")}: ${formatMoney(totalCredit, L)}`} />
      <Card padded={false}>
        <Table head={<tr><th className="px-4 py-3 text-left">{fin(L, "student")}</th><th className="px-3 py-3 text-right">{fin(L, "debt")}</th><th className="px-3 py-3 text-right">{fin(L, "credit")}</th><th className="px-3 py-3 text-right">{fin(L, "net")}</th></tr>}>
          {rows.length === 0 ? <EmptyRow colSpan={4} text={fin(L, "empty")} /> : rows.map((r) => (
            <tr key={r.studentId} className="text-sm">
              <td className="px-4 py-2.5"><a className="font-medium text-brand-700 hover:underline" href={`/students/${r.studentId}`}>{r.fullName}</a></td>
              <td className="px-3 py-2.5 text-right tabular-nums text-red-600">{r.debt ? formatMoney(r.debt, L) : "—"}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600">{r.credit ? formatMoney(r.credit, L) : "—"}</td>
              <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${r.net < 0 ? "text-red-600" : "text-emerald-600"}`}>{formatMoney(r.net, L)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
