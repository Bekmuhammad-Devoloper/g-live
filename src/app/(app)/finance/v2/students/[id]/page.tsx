import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatMoney, PAYMENT_METHODS } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { chargeAllocationSums, paymentAvailability, remainingOf, studentBalance } from "@/lib/finance/billing/balance";
import { resolveFee } from "@/lib/finance/billing/fees";
import { tashkentYearMonth, yearMonthKey } from "@/lib/finance/period";
import { assertBranchAccess } from "@/lib/finance/permissions";
import { Card, Forbidden, PageHeader, StatCard } from "../../../../_components/ui";
import { fin } from "../../_i18n";
import { financePage } from "../../_shared";
import StudentFinanceView, { type ChargeRow, type DiscountRow, type EarningRow, type PaymentRow } from "./StudentFinanceView";

// O'quvchi moliyasi — buxgalter/direktor ish joyi: charge'lar, to'lovlar, kredit, chegirma/kelishilgan narx,
// o'qituvchi ulushlari; tuzatishlar faqat V2 dvigateli orqali (reversal/replacement), tarix o'chirilmaydi.
export const dynamic = "force-dynamic";

export default async function StudentFinancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, can, flags } = await financePage();
  const L = session.locale;
  if (!can("FINANCE_VIEW")) return <Forbidden title={fin(L, "forbiddenTitle")} body={fin(L, "forbidden")} />;
  const student = await prisma.student.findUnique({
    where: { id },
    select: { id: true, fullName: true, phone: true, eduStatus: true, branchId: true, branch: { select: { name: true } }, enrollments: { where: { isActive: true, leftAt: null }, select: { group: { select: { id: true, name: true, program: { select: { name: true } } } } } } },
  });
  if (!student) notFound();
  try { assertBranchAccess(session, student.branchId); } catch { return <Forbidden title={fin(L, "forbiddenTitle")} body={fin(L, "forbidden")} />; }

  const ym = tashkentYearMonth(new Date());
  const [balance, charges, payments, discounts, earnings, accounts] = await Promise.all([
    studentBalance(prisma, id),
    prisma.studentCharge.findMany({ where: { studentId: id }, orderBy: [{ serviceYear: "desc" }, { serviceMonth: "desc" }, { createdAt: "desc" }], include: { group: { select: { name: true } } } }),
    prisma.payment.findMany({ where: { studentId: id, postedAt: { not: null }, OR: [{ legacyRole: null }, { legacyRole: "HISTORICAL" }] }, orderBy: [{ receivedAt: "desc" }], include: { financialAccount: { select: { name: true } }, refunds: { select: { amount: true, status: true } } } }),
    prisma.studentDiscount.findMany({ where: { studentId: id }, orderBy: { effectiveFrom: "desc" }, include: { group: { select: { name: true } } } }),
    can("SALARY_VIEW") ? prisma.teacherEarning.findMany({ where: { studentId: id }, orderBy: { createdAt: "desc" }, take: 100, include: { teacher: { select: { fullName: true } } } }) : Promise.resolve([]),
    prisma.financialAccount.findMany({ where: { isActive: true, ...(student.branchId ? { OR: [{ branchId: student.branchId }, { branchId: null }] } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const sums = await chargeAllocationSums(prisma, charges.map((c) => c.id));
  const avail = await paymentAvailability(prisma, payments.map((p) => p.id));
  const feeInfo = await Promise.all(student.enrollments.map(async (g) => ({ group: g.group.name, fee: await resolveFee(prisma, { studentId: id, groupId: g.group.id, branchId: student.branchId, serviceMonth: ym }) })));

  const chargeRows: ChargeRow[] = charges.map((c) => ({
    id: c.id, month: yearMonthKey({ year: c.serviceYear, month: c.serviceMonth }), group: c.group?.name ?? null, kind: c.kind, status: c.status,
    original: c.originalAmount, discount: c.discountAmount, final: c.finalAmount, allocated: (sums.get(c.id)?.allocated ?? 0) - (sums.get(c.id)?.reversed ?? 0), remaining: c.status === "CANCELLED" ? 0 : remainingOf(c.finalAmount, sums.get(c.id)),
    feeSource: (() => { try { return (JSON.parse(c.snapshot ?? "{}") as { fee?: { source?: string } }).fee?.source ?? null; } catch { return null; } })(),
    replacesChargeId: c.replacesChargeId, adjustsChargeId: c.adjustsChargeId, cancelledAt: c.cancelledAt?.toISOString() ?? null,
  }));
  const paymentRows: PaymentRow[] = payments.map((p) => {
    const a = avail.get(p.id);
    return { id: p.id, receivedAt: p.receivedAt!.toISOString(), amount: p.amount, method: p.method, account: p.financialAccount?.name ?? null, status: p.status, docNumber: p.docNumber, historical: p.legacyRole === "HISTORICAL", allocated: (a?.allocated ?? 0) - (a?.reversed ?? 0), refunded: p.refunds.filter((r) => r.status === "DONE").reduce((s, r) => s + r.amount, 0), unallocated: a?.unallocated ?? 0 };
  });
  const discountRows: DiscountRow[] = discounts.map((d) => ({ id: d.id, type: d.type, value: d.value, group: d.group?.name ?? null, from: d.effectiveFrom.toISOString(), to: d.effectiveTo?.toISOString() ?? null, isActive: d.isActive, reason: d.reason }));
  const earningRows: EarningRow[] = earnings.map((e) => ({ id: e.id, teacher: e.teacher.fullName, type: e.type, amount: e.amount, rateBp: e.rateBp, serviceMonth: e.serviceYear && e.serviceMonth ? yearMonthKey({ year: e.serviceYear, month: e.serviceMonth }) : null, earningMonth: yearMonthKey({ year: e.earningYear, month: e.earningMonth }), status: e.status, reviewReason: e.reviewReason }));

  return (
    <>
      <PageHeader title={`${fin(L, "studentFinance")}: ${student.fullName}`} subtitle={`${student.branch?.name ?? "—"} · ${student.enrollments.map((g) => g.group.name).join(", ") || tr(L, { uz: "guruhsiz", ru: "без группы", en: "no group", de: "ohne Gruppe" })} · ${student.eduStatus}`} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label={fin(L, "debt")} value={formatMoney(balance.debt, L)} tone={balance.debt > 0 ? "red" : "default"} icon="alert" />
        <StatCard label={fin(L, "credit")} value={formatMoney(balance.credit, L)} tone="green" icon="wallet" />
        <StatCard label={fin(L, "feeSource")} value={feeInfo.map((f) => `${f.group}: ${f.fee ? `${formatMoney(f.fee.amount, L)} (${f.fee.source})` : "—"}`).join(" · ") || "—"} icon="clipboard" />
      </div>
      {feeInfo.some((f) => !f.fee) && (
        <Card className="mb-4 border-red-200 bg-red-50/40"><p className="text-sm text-red-700">{tr(L, { uz: "Diqqat: bu o'quvchi guruhi uchun oylik narx sozlanmagan — charge yaratilmaydi va to'lov qabul qilinmaydi. Guruh/kurs narxini kiriting yoki quyida kelishilgan narxni belgilang.", ru: "Внимание: для группы ученика не задана месячная цена — начисления и платежи невозможны. Укажите цену группы/курса или договорную цену ниже.", en: "Monthly fee is not configured for this student's group — charges and payments are blocked. Set the group/program fee or an agreed price below.", de: "Für die Gruppe ist keine Monatsgebühr hinterlegt — Forderungen/Zahlungen sind blockiert. Gruppen-/Kurspreis oder vereinbarten Preis setzen." })}</p></Card>
      )}
      <StudentFinanceView locale={L} enabled={flags.enabled} studentId={id} groups={student.enrollments.map((g) => ({ id: g.group.id, name: g.group.name }))} accounts={accounts} methods={[...PAYMENT_METHODS]} charges={chargeRows} payments={paymentRows} discounts={discountRows} earnings={earningRows}
        perms={{ pay: can("PAYMENT_CREATE"), correct: can("PAYMENT_CORRECT"), refund: can("PAYMENT_CANCEL"), salary: can("SALARY_VIEW") }} />
    </>
  );
}
