import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { canRead, MODULES } from "@/lib/rbac";
import { formatMoney, PAYMENT_STATUS_LABELS, label } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { PageHeader, Card, HubCard, StatCard, Table, EmptyRow, Badge, Forbidden } from "../_components/ui";
import ExportButton from "../payments/ExportButton";

export default async function FinancePage() {
  const s = await requireSession();
  const t = getT(s.locale);
  if (!canRead(s.role, MODULES.PAYMENTS)) {
    return <Forbidden title={t("err.forbidden")} body={t("err.forbiddenBody")} />;
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [paidAgg, monthAgg, cancelled, recent, manualCount] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID" } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID", createdAt: { gte: monthStart } } }),
    prisma.payment.count({ where: { status: "CANCELLED" } }),
    prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { student: true } }),
    prisma.payment.count({ where: { isManual: true } }),
  ]);

  const df = new Intl.DateTimeFormat(s.locale === "ru" ? "ru-RU" : "uz-UZ");
  const exportColumns = [
    { key: "student", label: tr(s.locale, { uz: "O'quvchi", ru: "Ученик", en: "Student" }) },
    { key: "amount", label: tr(s.locale, { uz: "Summa", ru: "Сумма", en: "Amount" }) },
    { key: "method", label: tr(s.locale, { uz: "Usul", ru: "Способ", en: "Method" }) },
    { key: "status", label: tr(s.locale, { uz: "Holat", ru: "Статус", en: "Status" }) },
    { key: "date", label: tr(s.locale, { uz: "Sana", ru: "Дата", en: "Date" }) },
  ];
  const exportData = recent.map((p) => ({
    student: p.student.fullName,
    amount: p.amount,
    method: p.method,
    status: label(PAYMENT_STATUS_LABELS, p.status, s.locale),
    date: df.format(p.createdAt),
  }));

  return (
    <>
      <PageHeader
        title={tr(s.locale, { uz: "Moliya", ru: "Финансы", en: "Finance" })}
        subtitle={tr(s.locale, { uz: "To'lovlar, tushum va ish haqi", ru: "Платежи, доход и зарплата", en: "Payments, revenue and salary" })}
        action={
          <ExportButton
            rows={exportData}
            columns={exportColumns}
            filename="moliya-oxirgi-tolovlar"
            label={s.locale === "ru" ? "Экспорт" : s.locale === "en" ? "Export" : "Eksport"}
          />
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={tr(s.locale, { uz: "Umumiy tushum", ru: "Общий доход", en: "Total revenue" })} value={formatMoney(paidAgg._sum.amount ?? 0, s.locale)} tone="green" icon="wallet" />
        <StatCard label={tr(s.locale, { uz: "Shu oy", ru: "Этот месяц", en: "This month" })} value={formatMoney(monthAgg._sum.amount ?? 0, s.locale)} tone="brand" icon="chart" />
        <StatCard label={tr(s.locale, { uz: "Qo'lda kiritilgan", ru: "Введено вручную", en: "Entered manually" })} value={manualCount} tone="amber" icon="card" />
        <StatCard label={tr(s.locale, { uz: "Bekor qilingan", ru: "Отменено", en: "Cancelled" })} value={cancelled} tone="red" icon="history" />
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <HubCard href="/payments" icon="card" title={tr(s.locale, { uz: "To'lovlar", ru: "Платежи", en: "Payments" })} desc={tr(s.locale, { uz: "Onlayn va qo'lda to'lov, bekor qilish, audit", ru: "Онлайн и ручные платежи, отмена, аудит", en: "Online and manual payments, cancellation, audit" })} />
        <HubCard href="/salary" icon="wallet" title={tr(s.locale, { uz: "Ish haqi", ru: "Зарплата", en: "Salary" })} desc={tr(s.locale, { uz: "O'qituvchilar yuklamasi va hisob-kitob", ru: "Нагрузка преподавателей и расчёт", en: "Teacher workload and calculation" })} />
        <HubCard href="/reports" icon="chart" title={tr(s.locale, { uz: "Hisobotlar", ru: "Отчёты", en: "Reports" })} desc={tr(s.locale, { uz: "Tushum, konversiya va operatsion ko'rsatkichlar", ru: "Доход, конверсия и операционные показатели", en: "Revenue, conversion and operational metrics" })} />
      </div>

      <Card padded={false}>
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-700">{tr(s.locale, { uz: "Oxirgi to'lovlar", ru: "Последние платежи", en: "Recent payments" })}</h3>
        </div>
        <Table
          head={
            <tr>
              <th className="px-4 py-3">{tr(s.locale, { uz: "O'quvchi", ru: "Ученик", en: "Student" })}</th>
              <th className="px-4 py-3">{tr(s.locale, { uz: "Summa", ru: "Сумма", en: "Amount" })}</th>
              <th className="px-4 py-3">{tr(s.locale, { uz: "Usul", ru: "Способ", en: "Method" })}</th>
              <th className="px-4 py-3">{tr(s.locale, { uz: "Holat", ru: "Статус", en: "Status" })}</th>
              <th className="px-4 py-3">{tr(s.locale, { uz: "Sana", ru: "Дата", en: "Date" })}</th>
            </tr>
          }
        >
          {recent.length === 0 ? (
            <EmptyRow colSpan={5} text={tr(s.locale, { uz: "To'lov yo'q", ru: "Нет платежей", en: "No payments" })} />
          ) : (
            recent.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{p.student.fullName}</td>
                <td className="px-4 py-3 font-semibold text-slate-800">{formatMoney(p.amount, s.locale)}</td>
                <td className="px-4 py-3 text-slate-600">{p.method}</td>
                <td className="px-4 py-3">
                  <Badge tone={p.status === "PAID" ? "green" : p.status === "CANCELLED" ? "red" : "amber"}>
                    {label(PAYMENT_STATUS_LABELS, p.status, s.locale)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {new Intl.DateTimeFormat(s.locale === "ru" ? "ru-RU" : "uz-UZ").format(p.createdAt)}
                </td>
              </tr>
            ))
          )}
        </Table>
      </Card>

      <p className="mt-4 text-xs text-slate-400">
        ℹ️ {tr(s.locale, { uz: "Keyingi bosqich: 6 xil to'lov rejimi (oylik, kunlik, modul, kurs, individual), xarajatlar va qarzdorlik nazorati.", ru: "Следующий этап: 6 режимов оплаты (месячная, дневная, модуль, курс, индивидуальная), контроль расходов и задолженности.", en: "Next stage: 6 payment modes (monthly, daily, module, course, individual), expense and debt control." })}
      </p>
    </>
  );
}
