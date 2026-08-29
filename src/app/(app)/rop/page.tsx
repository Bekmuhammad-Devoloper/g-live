import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, canSeeTeamReports, MODULES } from "@/lib/rbac";
import { ROLES, LEAD_STAGE_LABELS, label, type Locale } from "@/lib/constants";
import { branchWhere } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { Forbidden, HubCard } from "../_components/ui";
import { Icon } from "../_components/Icon";

// ─── Sotuv bo'limi boshlig'i (ROP) command-center dashboard ───
// Imkon CRM ROP dashboardidan moslashtirilgan — GL EDU lead/operator/call ma'lumotidan.

type TL = { uz: string; ru: string; en: string; de: string };
type Period = "today" | "week" | "month" | "year";
const PERIODS: { key: Period; label: TL; short: TL }[] = [
  { key: "today", label: { uz: "Bugun", ru: "Сегодня", en: "Today", de: "Heute" }, short: { uz: "bugun", ru: "сегодня", en: "today", de: "heute" } },
  { key: "week", label: { uz: "Hafta", ru: "Неделя", en: "Week", de: "Woche" }, short: { uz: "hafta", ru: "неделя", en: "week", de: "Woche" } },
  { key: "month", label: { uz: "Oy", ru: "Месяц", en: "Month", de: "Monat" }, short: { uz: "oy", ru: "месяц", en: "month", de: "Monat" } },
  { key: "year", label: { uz: "Yil", ru: "Год", en: "Year", de: "Jahr" }, short: { uz: "yil", ru: "год", en: "year", de: "Jahr" } },
];

const NEW_STAGES = ["NEW"];
const REPROCESS_STAGES = ["IN_PROGRESS", "CONTACTED"];
const ADMIN_STAGES = ["AWAITING_PAYMENT"];

const stageTone: Record<string, "slate" | "green" | "red" | "amber" | "blue" | "brand"> = {
  NEW: "blue", IN_PROGRESS: "amber", CONTACTED: "amber", TEST: "slate", OFFER: "brand",
  AWAITING_PAYMENT: "amber", PAID: "green", WON: "green", LOST: "red",
};

const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
function hue(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export default async function RopDashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const s = await requireSession();
  const locale = s.locale as Locale;
  if (!canSeeTeamReports(s.role)) {
    return <Forbidden title={tr(locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(locale, { uz: "Bu bo'lim savdo bo'limi uchun.", ru: "Этот раздел для отдела продаж.", en: "This section is for the sales department.", de: "Dieser Bereich ist für die Vertriebsabteilung." })} />;
  }
  const sp = await searchParams;
  const period = (PERIODS.find((p) => p.key === sp.period)?.key ?? "today") as Period;
  const periodShort = tr(locale, PERIODS.find((p) => p.key === period)!.short);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const from =
    period === "week" ? new Date(todayStart.getTime() - 6 * 86400000)
    : period === "month" ? new Date(now.getFullYear(), now.getMonth(), 1)
    : period === "year" ? new Date(now.getFullYear(), 0, 1)
    : todayStart;

  const [operators, leads, todayCalls] = await Promise.all([
    // faol filial doirasida
    prisma.user.findMany({ where: { AND: [{ role: ROLES.OPERATOR, isActive: true }, branchWhere(s)] }, select: { id: true, fullName: true } }),
    prisma.lead.findMany({
      where: branchWhere(s), // faol filial doirasida
      orderBy: { createdAt: "desc" },
      select: { id: true, managerId: true, stage: true, createdAt: true, fullName: true, phone: true, source: true },
    }),
    // Call'da branchId yo'q — operator filiali bo'yicha (operatorsizlar hamma joyda)
    prisma.call.count({ where: { AND: [{ startedAt: { gte: todayStart } }, { OR: [{ operator: branchWhere(s) }, { operatorId: null }] }] } }),
  ]);

  // ── Pipeline (joriy holat) ──
  const newLeads = leads.filter((l) => NEW_STAGES.includes(l.stage)).length;
  const assigned = leads.filter((l) => l.managerId).length;
  const adminSent = leads.filter((l) => ADMIN_STAGES.includes(l.stage)).length;
  const reprocess = leads.filter((l) => REPROCESS_STAGES.includes(l.stage)).length;
  const won = leads.filter((l) => l.stage === "WON").length;
  const conv = leads.length ? Math.round((won / leads.length) * 100) : 0;
  const createdInPeriod = leads.filter((l) => l.createdAt >= from).length;
  const wonInPeriod = leads.filter((l) => l.stage === "WON" && l.createdAt >= from).length;

  // ── Top operatorlar ──
  const topOperators = operators
    .map((op) => {
      const mine = leads.filter((l) => l.managerId === op.id);
      const opWon = mine.filter((l) => l.stage === "WON").length;
      return { id: op.id, name: op.fullName, total: mine.length, won: opWon, conv: mine.length ? Math.round((opWon / mine.length) * 100) : 0 };
    })
    .sort((a, b) => b.conv - a.conv || b.won - a.won || b.total - a.total)
    .slice(0, 5);

  const recentLeads = leads.slice(0, 7);

  const QUICK = [
    { href: "/crm", icon: "download", title: tr(locale, { uz: "Lidlar", ru: "Лиды", en: "Leads", de: "Leads" }), desc: tr(locale, { uz: "Buyurtmalar bazasi", ru: "База заявок", en: "Orders database", de: "Bestellungsdatenbank" }) },
    { href: "/rop/operators", icon: "headphones", title: tr(locale, { uz: "Operatorlar", ru: "Операторы", en: "Operators", de: "Operatoren" }), desc: tr(locale, { uz: "Jamoa nazorati", ru: "Контроль команды", en: "Team monitoring", de: "Teamüberwachung" }) },
    { href: "/rop/kpi-settings", icon: "trophy", title: "KPI", desc: tr(locale, { uz: "Sozlamalar & reyting", ru: "Настройки и рейтинг", en: "Settings & rating", de: "Einstellungen & Rangliste" }) },
    { href: "/reports/calls", icon: "phone", title: tr(locale, { uz: "Qo'ng'iroqlar", ru: "Звонки", en: "Calls", de: "Anrufe" }), desc: tr(locale, { uz: "Qo'ng'iroqlar markazi", ru: "Центр звонков", en: "Call center", de: "Anrufzentrale" }) },
    { href: "/links", icon: "link", title: tr(locale, { uz: "Havolalar", ru: "Ссылки", en: "Links", de: "Links" }), desc: tr(locale, { uz: "Maxsus linklar", ru: "Специальные ссылки", en: "Special links", de: "Spezielle Links" }) },
    { href: "/reports/funnel", icon: "megaphone", title: tr(locale, { uz: "Voronka", ru: "Воронка", en: "Funnel", de: "Trichter" }), desc: tr(locale, { uz: "Sotuv voronkasi", ru: "Воронка продаж", en: "Sales funnel", de: "Verkaufstrichter" }) },
    { href: "/marketing", icon: "bell", title: tr(locale, { uz: "Xabarlar", ru: "Сообщения", en: "Messages", de: "Nachrichten" }), desc: "Marketing" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <Icon name="chart" className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "ROP Dashboard", ru: "Панель РОП", en: "ROP Dashboard", de: "ROP-Dashboard" })}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Operatorlar nazorati va lidlar boshqaruvi", ru: "Контроль операторов и управление лидами", en: "Operator monitoring and lead management", de: "Operatorenüberwachung und Lead-Verwaltung" })}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-1 dark:border-slate-700 dark:bg-slate-800/40">
          {PERIODS.map((p) => (
            <Link key={p.key} href={`/rop?period=${p.key}`}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${period === p.key ? "bg-brand-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}>
              {tr(locale, p.label)}
            </Link>
          ))}
          <Link href={`/rop?period=${period}`} title={tr(locale, { uz: "Yangilash", ru: "Обновить", en: "Refresh", de: "Aktualisieren" })} className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700">
            <Icon name="refresh" className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RopTile icon="download" tone="brand" value={newLeads} label={tr(locale, { uz: "Yangi lidlar", ru: "Новые лиды", en: "New leads", de: "Neue Leads" })} delta={`+${createdInPeriod} ${periodShort}`} deltaTone="brand" />
        <RopTile icon="headphones" tone="amber" value={operators.length} label={tr(locale, { uz: "Faol operatorlar", ru: "Активные операторы", en: "Active operators", de: "Aktive Operatoren" })} delta={tr(locale, { uz: `${assigned} biriktirilgan`, ru: `${assigned} назначено`, en: `${assigned} assigned`, de: `${assigned} zugewiesen` })} deltaTone="slate" />
        <RopTile icon="check" tone="green" value={won} label={tr(locale, { uz: "Muvaffaqiyatli", ru: "Успешные", en: "Successful", de: "Erfolgreich" })} delta={tr(locale, { uz: `${conv}% konversiya`, ru: `${conv}% конверсия`, en: `${conv}% conversion`, de: `${conv}% Konversion` })} deltaTone={conv >= 30 ? "green" : "red"} />
        <RopTile icon="arrowUpRight" tone="violet" value={adminSent} label={tr(locale, { uz: "To'lovga yuborilgan", ru: "Отправлено на оплату", en: "Sent for payment", de: "Zur Zahlung gesendet" })} delta={tr(locale, { uz: `${reprocess} qayta ishlash`, ru: `${reprocess} в доработке`, en: `${reprocess} reprocessing`, de: `${reprocess} in Bearbeitung` })} deltaTone="slate" />
      </div>

      {/* Top operatorlar + So'nggi lidlar */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top operatorlar */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4 dark:border-slate-800">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-700 dark:text-slate-200"><Icon name="trophy" className="h-5 w-5 text-amber-500" /> {tr(locale, { uz: "Top Operatorlar", ru: "Топ операторы", en: "Top Operators", de: "Top-Operatoren" })}</h2>
            <Link href="/rop/operators" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">{tr(locale, { uz: "Barchasi", ru: "Все", en: "All", de: "Alle" })}</Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {topOperators.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-400">{tr(locale, { uz: "Operatorlar yo'q", ru: "Операторов нет", en: "No operators", de: "Keine Operatoren" })}</div>
            ) : (
              topOperators.map((op, i) => (
                <div key={op.id} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-800 dark:text-slate-100">{op.name}</div>
                    <div className="text-xs text-slate-400">{op.won}/{op.total} {tr(locale, { uz: "lid", ru: "лид", en: "leads", de: "Leads" })}</div>
                  </div>
                  <span className={`text-sm font-bold ${op.conv >= 30 ? "text-emerald-600 dark:text-emerald-400" : op.conv > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-400"}`}>{op.conv}%</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* So'nggi lidlar */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4 dark:border-slate-800">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-700 dark:text-slate-200"><Icon name="users" className="h-5 w-5 text-brand-500" /> {tr(locale, { uz: "So'nggi lidlar", ru: "Последние лиды", en: "Recent leads", de: "Neueste Leads" })}</h2>
            <Link href="/crm" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">{tr(locale, { uz: "Barchasi", ru: "Все", en: "All", de: "Alle" })}</Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentLeads.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-400">{tr(locale, { uz: "Lidlar yo'q", ru: "Лидов нет", en: "No leads", de: "Keine Leads" })}</div>
            ) : (
              recentLeads.map((l) => (
                <Link key={l.id} href={`/crm/${l.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: `hsl(${hue(l.fullName)} 60% 55%)` }}>{initials(l.fullName)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-800 dark:text-slate-100">{l.fullName}</div>
                    <div className="truncate text-xs text-slate-400">{l.phone}{l.source ? ` · ${l.source}` : ""}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StageBadge stage={l.stage} locale={locale} />
                    <span className="text-[11px] text-slate-400">{fmtDate(l.createdAt)}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Tezkor havolalar */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">{tr(locale, { uz: "Tezkor havolalar", ru: "Быстрые ссылки", en: "Quick links", de: "Schnellzugriffe" })}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {QUICK.map((q) => (
            <HubCard key={q.title} href={q.href} icon={q.icon} title={q.title} desc={q.desc} />
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        ℹ️ {tr(locale, { uz: "Bugungi qo'ng'iroqlar", ru: "Звонки сегодня", en: "Calls today", de: "Anrufe heute" })}: <b className="text-slate-600 dark:text-slate-300">{todayCalls}</b> · {tr(locale, { uz: "Davr", ru: "Период", en: "Period", de: "Zeitraum" })}: {tr(locale, PERIODS.find((p) => p.key === period)!.label)} · {tr(locale, { uz: "Muvaffaqiyatli", ru: "Успешные", en: "Successful", de: "Erfolgreich" })} ({periodShort}): {wonInPeriod}
      </p>
    </div>
  );
}

const iconTone: Record<string, string> = {
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
};
const deltaClass: Record<string, string> = {
  brand: "text-brand-600 dark:text-brand-300",
  green: "text-emerald-600 dark:text-emerald-400",
  red: "text-rose-500 dark:text-rose-400",
  slate: "text-slate-400",
};

function RopTile({ icon, tone, value, label, delta, deltaTone }: { icon: string; tone: string; value: number; label: string; delta: string; deltaTone: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card transition hover:shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconTone[tone] ?? iconTone.brand}`}>
          <Icon name={icon} className="h-5 w-5" />
        </div>
        <span className={`text-xs font-semibold ${deltaClass[deltaTone] ?? deltaClass.slate}`}>{delta}</span>
      </div>
      <div className="mt-3 text-[32px] font-bold leading-none tracking-tight text-slate-900 dark:text-slate-100">{value}</div>
      <div className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}

function StageBadge({ stage, locale }: { stage: string; locale: Locale }) {
  const tone = stageTone[stage] ?? "slate";
  const cls: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
    red: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
    amber: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
    brand: "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30",
    slate: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${cls[tone]}`}>{label(LEAD_STAGE_LABELS, stage, locale)}</span>;
}
