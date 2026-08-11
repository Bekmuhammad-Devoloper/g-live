import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { canRead, canWrite, MODULES } from "@/lib/rbac";
import { PAYMENT_STATUS_LABELS, label, formatMoney } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { PageHeader, Table, EmptyRow, Badge, Forbidden, StatCard } from "../_components/ui";
import NewPaymentForm from "./NewPaymentForm";
import OnlinePaymentForm from "./OnlinePaymentForm";
import CancelButton from "./CancelButton";
import ExportButton from "./ExportButton";

const statusTone: Record<string, "slate" | "green" | "red" | "amber"> = {
  PENDING: "amber",
  PAID: "green",
  REFUNDED: "slate",
  CANCELLED: "red",
};

export default async function PaymentsPage() {
  const s = await requireSession();
  const t = getT(s.locale);

  if (!canRead(s.role, MODULES.PAYMENTS)) {
    return <Forbidden title={t("err.forbidden")} body={t("err.forbiddenBody")} />;
  }

  const [payments, students, paidAgg] = await Promise.all([
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      include: { student: true, author: true },
    }),
    prisma.student.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID" } }),
  ]);

  const writable = canWrite(s.role, MODULES.PAYMENTS);

  const df = new Intl.DateTimeFormat(s.locale === "ru" ? "ru-RU" : "uz-UZ");
  const exportColumns = [
    { key: "student", label: t("pay.student") },
    { key: "amount", label: t("common.amount") },
    { key: "method", label: t("pay.method") },
    { key: "purpose", label: t("pay.purpose") },
    { key: "status", label: t("common.status") },
    { key: "date", label: t("common.date") },
    { key: "author", label: t("pay.author") },
  ];
  const exportData = payments.map((p) => ({
    student: p.student.fullName,
    amount: p.amount,
    method: p.method,
    purpose: p.purpose ?? "",
    status: label(PAYMENT_STATUS_LABELS, p.status, s.locale),
    date: df.format(p.createdAt),
    author: p.author?.fullName ?? "",
  }));

  return (
    <>
      <PageHeader
        title={t("pay.title")}
        subtitle={writable ? undefined : tr(s.locale, { uz: "Sizda qo'lda to'lov kiritish huquqi yo'q (faqat ko'rish).", ru: "У вас нет прав на ручной ввод платежей (только просмотр).", en: "You do not have permission to enter manual payments (view only)." })}
        action={
          <div className="flex flex-wrap gap-2">
            <ExportButton rows={exportData} columns={exportColumns} filename="tolovlar" label={s.locale === "ru" ? "Экспорт" : s.locale === "en" ? "Export" : "Eksport"} />
            {writable && (
              <>
                <OnlinePaymentForm locale={s.locale} students={students} />
                <NewPaymentForm locale={s.locale} students={students} />
              </>
            )}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("reports.revenue")} value={formatMoney(paidAgg._sum.amount ?? 0, s.locale)} tone="green" icon="wallet" />
        <StatCard label={tr(s.locale, { uz: "Jami yozuvlar", ru: "Всего записей", en: "Total records" })} value={payments.length} icon="card" />
      </div>

      <Table
        head={
          <tr>
            <th className="px-4 py-3">{t("pay.student")}</th>
            <th className="px-4 py-3">{t("common.amount")}</th>
            <th className="px-4 py-3">{t("pay.method")}</th>
            <th className="px-4 py-3">{t("pay.purpose")}</th>
            <th className="px-4 py-3">{t("common.status")}</th>
            <th className="px-4 py-3">{t("common.date")}</th>
            <th className="px-4 py-3">{t("pay.author")}</th>
            {writable && <th className="px-4 py-3">{t("common.actions")}</th>}
          </tr>
        }
      >
        {payments.length === 0 ? (
          <EmptyRow colSpan={writable ? 8 : 7} text={t("common.noData")} />
        ) : (
          payments.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{p.student.fullName}</td>
              <td className="px-4 py-3 font-semibold text-slate-800">{formatMoney(p.amount, s.locale)}</td>
              <td className="px-4 py-3 text-slate-600">{p.method}</td>
              <td className="px-4 py-3 text-slate-500">{p.purpose ?? "—"}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <Badge tone={statusTone[p.status] ?? "slate"}>{label(PAYMENT_STATUS_LABELS, p.status, s.locale)}</Badge>
                  {p.isManual && <Badge tone="amber">{t("pay.manual")}</Badge>}
                </div>
              </td>
              <td className="px-4 py-3 text-slate-500">
                {new Intl.DateTimeFormat(s.locale === "ru" ? "ru-RU" : "uz-UZ").format(p.createdAt)}
              </td>
              <td className="px-4 py-3 text-slate-500">{p.author?.fullName ?? "—"}</td>
              {writable && (
                <td className="px-4 py-3">
                  {p.status !== "CANCELLED" ? <CancelButton id={p.id} locale={s.locale} /> : <span className="text-xs text-slate-400">—</span>}
                </td>
              )}
            </tr>
          ))
        )}
      </Table>

      <p className="mt-3 text-xs text-slate-400">
        ℹ️ {tr(s.locale, { uz: "To'lov yozuvlarini o'chirish taqiqlangan — faqat «bekor qilish» amali audit bilan qayd etiladi (TZ FR-PAY-04).", ru: "Удаление платёжных записей запрещено — только операция «отмена» фиксируется в аудите (ТЗ FR-PAY-04).", en: "Deleting payment records is prohibited — only the «cancel» action is logged in the audit (TS FR-PAY-04)." })}
      </p>
    </>
  );
}
