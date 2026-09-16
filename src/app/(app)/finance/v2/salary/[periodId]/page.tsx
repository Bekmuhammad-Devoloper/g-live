import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/constants";
import { assertSalaryView } from "@/lib/finance/permissions";
import { periodEarningDetails, periodSummary } from "@/lib/finance/salary/periods";
import { bpToPercentString } from "@/lib/finance/money";
import { yearMonthKey } from "@/lib/finance/period";
import { Badge, Card, EmptyRow, Forbidden, PageHeader, StatCard, Table } from "../../../../_components/ui";
import { fin, fmtDate } from "../../_i18n";
import { financePage } from "../../_shared";
import ReviewList from "./ReviewList";

// O'qituvchi oyligi tafsiloti (reja §15) + NEEDS_REVIEW navbati.
export default async function SalaryPeriodDetail({ params }: { params: Promise<{ periodId: string }> }) {
  const { periodId } = await params;
  const { session, can, flags } = await financePage();
  const L = session.locale;
  const period = await prisma.salaryPeriod.findUnique({ where: { id: periodId }, include: { teacher: { select: { fullName: true } }, payouts: { include: { financialAccount: { select: { name: true } } }, orderBy: { paidAt: "asc" } } } });
  if (!period) notFound();
  try { assertSalaryView(session, period.teacherId); } catch { return <Forbidden title={fin(L, "forbiddenTitle")} body={fin(L, "forbidden")} />; }
  const [summary, details, review] = await Promise.all([
    periodSummary(prisma, period.id), periodEarningDetails(prisma, period.id),
    prisma.teacherEarning.findMany({ where: { teacherId: period.teacherId, status: "NEEDS_REVIEW" }, orderBy: { createdAt: "asc" }, include: { student: { select: { fullName: true } }, group: { select: { name: true } } } }),
  ]);
  return (
    <>
      <PageHeader title={`${period.teacher.fullName} · ${yearMonthKey({ year: period.year, month: period.month })}`} subtitle={`${fin(L, "status")}: ${period.status}${period.source === "LEGACY" ? " · legacy" : ""}`} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={fin(L, "fixed")} value={formatMoney(summary.fixedAmount, L)} />
        <StatCard label={fin(L, "earning")} value={formatMoney(summary.commissionAmount + summary.adjustmentAmount, L)} tone="brand" />
        <StatCard label={fin(L, "gross")} value={formatMoney(summary.grossAmount, L)} tone="green" />
        <StatCard label={fin(L, "remaining")} value={formatMoney(summary.remainingAmount, L)} tone="amber" />
      </div>
      {review.length > 0 && can("SALARY_APPROVE") && <ReviewList locale={L} enabled={flags.enabled} rows={review.map((e) => ({ id: e.id, type: e.type, amount: e.amount, reason: e.reviewReason ?? "", student: e.student?.fullName ?? null, group: e.group?.name ?? null, month: yearMonthKey({ year: e.earningYear, month: e.earningMonth }) }))} />}
      <Card padded={false}>
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800"><h3 className="text-sm font-semibold">{fin(L, "details")}</h3></div>
        <Table head={<tr><th className="px-4 py-3 text-left">{fin(L, "student")}</th><th className="px-3 py-3 text-left">{fin(L, "receivedAt")}</th><th className="px-3 py-3 text-left">{fin(L, "servicePeriod")}</th><th className="px-3 py-3 text-right">{fin(L, "allocated")}</th><th className="px-3 py-3 text-right">{fin(L, "base")}</th><th className="px-3 py-3 text-right">{fin(L, "rate")}</th><th className="px-3 py-3 text-right">{fin(L, "earning")}</th><th className="px-3 py-3 text-left">{fin(L, "group")}</th><th className="px-3 py-3 text-left">{fin(L, "type")}</th></tr>}>
          {details.length === 0 ? <EmptyRow colSpan={9} text={fin(L, "empty")} /> : details.map((d) => (
            <tr key={d.id} className="text-sm">
              <td className="px-4 py-2.5">{d.studentName ?? "—"}</td>
              <td className="px-3 py-2.5 text-slate-500">{fmtDate(L, d.paymentReceivedAt)}</td>
              <td className="px-3 py-2.5 text-slate-500">{d.servicePeriod ?? "—"} <span className="text-[11px] text-slate-400">→ {d.earningMonth}</span></td>
              <td className="px-3 py-2.5 text-right tabular-nums">{d.allocatedAmount !== null ? formatMoney(d.allocatedAmount, L) : "—"}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(d.eligibleAmount, L)}</td>
              <td className="px-3 py-2.5 text-right">{d.rateBp !== null ? bpToPercentString(d.rateBp) : "—"}</td>
              <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${d.amount < 0 ? "text-red-600" : ""}`}>{formatMoney(d.amount, L)}</td>
              <td className="px-3 py-2.5 text-slate-500">{d.groupName ?? "—"}{d.programName ? ` · ${d.programName}` : ""}</td>
              <td className="px-3 py-2.5"><Badge tone={d.type === "PAYMENT_COMMISSION" ? "brand" : d.type === "REFUND_ADJUSTMENT" || d.type === "PENALTY" ? "red" : "slate"}>{d.type}</Badge></td>
            </tr>
          ))}
        </Table>
      </Card>
      {period.payouts.length > 0 && (
        <Card className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">{fin(L, "payout")}</h3>
          <ul className="space-y-1 text-sm">{period.payouts.map((p) => <li key={p.id} className="flex justify-between"><span>{fmtDate(L, p.paidAt, true)} · {p.financialAccount.name}{p.note ? ` · ${p.note}` : ""}</span><span className="tabular-nums font-semibold">{formatMoney(p.amount, L)}</span></li>)}</ul>
        </Card>
      )}
    </>
  );
}
