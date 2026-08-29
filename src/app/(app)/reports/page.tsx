import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { canRead, MODULES } from "@/lib/rbac";
import { LEAD_STAGES, LEAD_STAGE_LABELS, label, formatMoney, ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { branchWhere, branchViaStudent } from "@/lib/branchScope";
import { PageHeader, StatCard, Card, HubCard, Forbidden } from "../_components/ui";

export default async function ReportsPage() {
  const s = await requireSession();
  const t = getT(s.locale);

  if (!canRead(s.role, MODULES.REPORTS)) {
    return <Forbidden title={t("err.forbidden")} body={t("err.forbiddenBody")} />;
  }

  const [activeStudents, totalStudents, leads, wonLeads, groups, paidAgg, byStage] = await Promise.all([
    prisma.student.count({ where: { AND: [{ eduStatus: "ACTIVE" }, branchWhere(s)] } }), // faol filial doirasida
    prisma.student.count({ where: branchWhere(s) }), // faol filial doirasida
    prisma.lead.count({ where: branchWhere(s) }), // faol filial doirasida
    prisma.lead.count({ where: { AND: [{ stage: "WON" }, branchWhere(s)] } }), // faol filial doirasida
    prisma.group.count({ where: { AND: [{ status: "ACTIVE" }, branchWhere(s)] } }), // faol filial doirasida
    prisma.payment.aggregate({ _sum: { amount: true }, where: { AND: [{ status: "PAID" }, branchViaStudent(s)] } }), // faol filial doirasida
    prisma.lead.groupBy({ by: ["stage"], _count: true, where: branchWhere(s) }), // faol filial doirasida
  ]);

  // Moliyaviy hisobot — faqat direktor, o'rinbosari va menejer
  const canFinance = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER].includes(s.role as never);
  const conversion = leads > 0 ? Math.round((wonLeads / leads) * 100) : 0;
  const stageCount = (st: string) => byStage.find((b) => b.stage === st)?._count ?? 0;
  const maxStage = Math.max(1, ...byStage.map((b) => b._count));

  return (
    <>
      <PageHeader title={t("reports.title")} subtitle={tr(s.locale, { uz: "Real vaqt operatsion va moliyaviy ko'rsatkichlar", ru: "Операционные и финансовые показатели в реальном времени", en: "Real-time operational and financial metrics", de: "Betriebs- und Finanzkennzahlen in Echtzeit" })} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("reports.activeStudents")} value={activeStudents} hint={`${tr(s.locale, { uz: "Jami", ru: "Всего", en: "Total", de: "Gesamt" })}: ${totalStudents}`} tone="brand" icon="users" />
        <StatCard label={t("reports.leads")} value={leads} hint={`${tr(s.locale, { uz: "Konversiya", ru: "Конверсия", en: "Conversion", de: "Konversion" })}: ${conversion}%`} icon="chart" />
        <StatCard label={t("reports.groups")} value={groups} icon="book" />
        <StatCard label={t("reports.revenue")} value={formatMoney(paidAgg._sum.amount ?? 0, s.locale)} tone="green" icon="wallet" />
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <HubCard href="/reports/leads" icon="download" title={tr(s.locale, { uz: "Lidlar hisoboti", ru: "Отчёт по лидам", en: "Leads report", de: "Lead-Bericht" })} desc={tr(s.locale, { uz: "Sana oralig'i bo'yicha lidlar soni va grafik", ru: "Количество лидов и график по диапазону дат", en: "Lead count and chart by date range", de: "Anzahl der Leads und Diagramm nach Datumsbereich" })} />
        {canFinance && <HubCard href="/reports/payments" icon="wallet" title={tr(s.locale, { uz: "To'lovlar hisoboti", ru: "Отчёт по платежам", en: "Payments report", de: "Zahlungsbericht" })} desc={tr(s.locale, { uz: "Tushum (kirim) sana oralig'i bo'yicha", ru: "Поступления (доход) по диапазону дат", en: "Revenue (income) by date range", de: "Einnahmen (Umsatz) nach Datumsbereich" })} />}
        {/* Administrator konversiya hisobotini ko'rmaydi (sahifa ham uni to'sadi) */}
        {s.role !== ROLES.ADMIN && (
          <HubCard href="/reports/conversion" icon="chart" title={tr(s.locale, { uz: "Konversiya hisoboti", ru: "Отчёт по конверсии", en: "Conversion report", de: "Konversionsbericht" })} desc={tr(s.locale, { uz: "Savdo voronkasi va konversiya ko'rsatkichlari", ru: "Воронка продаж и показатели конверсии", en: "Sales funnel and conversion metrics", de: "Verkaufstrichter und Konversionskennzahlen" })} />
        )}
        {/* Davomat analitikasi NAZORAT bo'limida turadi — bu yerda takrorlanmaydi.
            O'qituvchida Nazorat menyusi yo'q, shuning uchun unga ko'rsatiladi. */}
        {s.role === ROLES.TEACHER && (
          <HubCard href="/reports/attendance" icon="check" title={tr(s.locale, { uz: "Davomat hisoboti", ru: "Отчёт по посещаемости", en: "Attendance report", de: "Anwesenheitsbericht" })} desc={tr(s.locale, { uz: "Guruhlar bo'yicha davomat tahlili", ru: "Анализ посещаемости по группам", en: "Attendance analysis by group", de: "Anwesenheitsanalyse nach Gruppe" })} />
        )}
        <HubCard href="/reports/sms" icon="mail" title={tr(s.locale, { uz: "Xabarlar jurnali", ru: "Журнал сообщений", en: "Messages log", de: "Nachrichtenprotokoll" })} desc={tr(s.locale, { uz: "Yuborilgan SMS/Telegram/Push xabarlar", ru: "Отправленные SMS/Telegram/Push сообщения", en: "Sent SMS/Telegram/Push messages", de: "Gesendete SMS/Telegram/Push-Nachrichten" })} />
        <HubCard href="/reports/calls" icon="phone" title={tr(s.locale, { uz: "Qo'ng'iroqlar jurnali", ru: "Журнал звонков", en: "Calls log", de: "Anrufprotokoll" })} desc={tr(s.locale, { uz: "Lidlar bilan telefon aloqalari", ru: "Телефонные контакты с лидами", en: "Phone contacts with leads", de: "Telefonkontakte mit Leads" })} />
      </div>

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-slate-700">{tr(s.locale, { uz: "Savdo voronkasi", ru: "Воронка продаж", en: "Sales funnel", de: "Verkaufstrichter" })}</h3>
        <div className="space-y-2.5">
          {LEAD_STAGES.map((st) => {
            const c = stageCount(st);
            return (
              <div key={st} className="flex items-center gap-3">
                <div className="w-40 shrink-0 text-xs text-slate-500">{label(LEAD_STAGE_LABELS, st, s.locale)}</div>
                <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
                  <div
                    className="h-full rounded bg-brand-500"
                    style={{ width: `${Math.round((c / maxStage) * 100)}%` }}
                  />
                </div>
                <div className="w-8 text-right text-sm font-semibold text-slate-700">{c}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}
