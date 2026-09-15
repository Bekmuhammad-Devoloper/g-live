import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/constants";
import { monthEnd, monthStart } from "@/lib/finance/period";
import { Badge, Card, EmptyRow, Forbidden, PageHeader, Table } from "../../../_components/ui";
import { fin, fmtDate } from "../_i18n";
import { financePage, monthFromSearch } from "../_shared";
import MonthPicker from "../MonthPicker";

export default async function RefundsV2Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { session, branchId, can } = await financePage();
  const L = session.locale;
  if (!can("PAYMENT_CANCEL")) return <Forbidden title={fin(L, "forbiddenTitle")} body={fin(L, "forbidden")} />;
  const { ym, key } = monthFromSearch(await searchParams);
  const rows = await prisma.refund.findMany({
    where: { refundedAt: { gte: monthStart(ym), lt: monthEnd(ym) }, ...(branchId ? { branchId } : {}) },
    orderBy: { refundedAt: "desc" },
    include: { student: { select: { fullName: true } }, financialAccount: { select: { name: true } }, originalPayment: { select: { docNumber: true, amount: true } }, earnings: { select: { amount: true } } },
  });
  const total = rows.filter((r) => r.status === "DONE").reduce((a, r) => a + r.amount, 0);
  return (
    <>
      <PageHeader title={fin(L, "refunds")} subtitle={`${fin(L, "gross")}: ${formatMoney(total, L)}`} action={<MonthPicker value={key} />} />
      <Card padded={false}>
        <Table head={<tr><th className="px-4 py-3 text-left">{fin(L, "student")}</th><th className="px-3 py-3 text-right">{fin(L, "amount")}</th><th className="px-3 py-3 text-left">{fin(L, "type")}</th><th className="px-3 py-3 text-left">{fin(L, "account")}</th><th className="px-3 py-3 text-left">{fin(L, "date")}</th><th className="px-3 py-3 text-right">{fin(L, "earning")}</th><th className="px-3 py-3 text-left">{fin(L, "reason")}</th></tr>}>
          {rows.length === 0 ? <EmptyRow colSpan={7} text={fin(L, "empty")} /> : rows.map((r) => (
            <tr key={r.id} className="text-sm">
              <td className="px-4 py-2.5 font-medium">{r.student.fullName}<div className="text-[11px] text-slate-400">{r.originalPayment?.docNumber ?? (r.source === "LEGACY" ? "legacy" : "")}</div></td>
              <td className="px-3 py-2.5 text-right tabular-nums text-red-600">−{formatMoney(r.amount, L)}</td>
              <td className="px-3 py-2.5"><Badge tone={r.kind === "CORRECTION" ? "purple" : "amber"}>{r.kind}</Badge></td>
              <td className="px-3 py-2.5 text-slate-500">{r.financialAccount.name}</td>
              <td className="px-3 py-2.5 text-slate-500">{fmtDate(L, r.refundedAt, true)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{r.earnings.length ? formatMoney(r.earnings.reduce((a, e) => a + e.amount, 0), L) : "—"}</td>
              <td className="px-3 py-2.5 text-slate-500">{r.reason}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
