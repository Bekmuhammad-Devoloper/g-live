import { prisma } from "@/lib/db";
import { PAYMENT_METHODS } from "@/lib/constants";
import { Forbidden, PageHeader } from "../../../_components/ui";
import { fin } from "../_i18n";
import { financePage, monthFromSearch } from "../_shared";
import MonthPicker from "../MonthPicker";
import PaymentsView, { type PaymentRow, type StudentOpt, type AccountOpt } from "./PaymentsView";
import { monthEnd, monthStart } from "@/lib/finance/period";
import { paymentAvailability } from "@/lib/finance/billing/balance";

export default async function PaymentsV2Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { session, branchId, can, flags } = await financePage();
  const L = session.locale;
  if (!can("FINANCE_VIEW") && !can("PAYMENT_CREATE")) return <Forbidden title={fin(L, "forbiddenTitle")} body={fin(L, "forbidden")} />;
  const { ym, key } = monthFromSearch(await searchParams);
  const [payments, students, accounts] = await Promise.all([
    prisma.payment.findMany({
      where: { legacyRole: null, postedAt: { not: null }, receivedAt: { gte: monthStart(ym), lt: monthEnd(ym) }, ...(branchId ? { branchId } : {}) },
      orderBy: { receivedAt: "desc" },
      include: { student: { select: { fullName: true } }, financialAccount: { select: { name: true } }, allocations: { select: { kind: true, amount: true } }, refunds: { select: { amount: true, status: true } } },
    }),
    prisma.student.findMany({ where: { eduStatus: { notIn: ["ARCHIVED", "EXPELLED"] }, ...(branchId ? { branchId } : {}) }, select: { id: true, fullName: true, phone: true }, orderBy: { fullName: "asc" } }),
    prisma.financialAccount.findMany({ where: { isActive: true, ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}) }, select: { id: true, name: true, type: true, branchId: true }, orderBy: { name: "asc" } }),
  ]);
  const avail = await paymentAvailability(prisma, payments.map((p) => p.id));
  const rows: PaymentRow[] = payments.map((p) => ({
    id: p.id, student: p.student.fullName, amount: p.amount, method: p.method, account: p.financialAccount?.name ?? "—", receivedAt: p.receivedAt?.toISOString() ?? p.createdAt.toISOString(),
    status: p.status, docNumber: p.docNumber, allocated: p.allocations.filter((a) => a.kind === "ALLOCATION").reduce((a, x) => a + x.amount, 0) - p.allocations.filter((a) => a.kind === "REVERSAL").reduce((a, x) => a + x.amount, 0),
    refunded: p.refunds.filter((r) => r.status === "DONE").reduce((a, r) => a + r.amount, 0), unallocated: avail.get(p.id)?.unallocated ?? 0,
  }));
  const studentOpts: StudentOpt[] = students.map((s) => ({ id: s.id, name: s.fullName, phone: s.phone }));
  const accountOpts: AccountOpt[] = accounts.map((a) => ({ id: a.id, name: a.name, type: a.type }));
  return (
    <>
      <PageHeader title={fin(L, "payments")} action={<MonthPicker value={key} />} />
      <PaymentsView locale={L} rows={rows} students={studentOpts} accounts={accountOpts} methods={[...PAYMENT_METHODS]} canCreate={can("PAYMENT_CREATE") && flags.enabled} canCancel={can("PAYMENT_CANCEL") && flags.enabled} canCorrect={can("PAYMENT_CORRECT") && flags.enabled} />
    </>
  );
}
