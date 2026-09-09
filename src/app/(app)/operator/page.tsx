import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import { ROLES, LEAD_STAGE_LABELS, label, type Locale } from "@/lib/constants";
import { branchWhere } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import { Icon } from "../_components/Icon";

// ─── Operator konsoli (individual operator dashboard) ───
// Imkon Operator rolidan moslashtirilgan — o'z lid/qo'ng'iroq/KPI statistikasi.

type Period = "today" | "week" | "month" | "year";
const periodsFor = (locale: Locale): { key: Period; label: string }[] => [
  { key: "today", label: tr(locale, { uz: "Bugun", ru: "Сегодня", en: "Today", de: "Heute" }) },
  { key: "week", label: tr(locale, { uz: "Hafta", ru: "Неделя", en: "Week", de: "Woche" }) },
  { key: "month", label: tr(locale, { uz: "Oy", ru: "Месяц", en: "Month", de: "Monat" }) },
  { key: "year", label: tr(locale, { uz: "Yil", ru: "Год", en: "Year", de: "Jahr" }) },
];
const DOW: Record<Locale, string[]> = {
  uz: ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"],
  ru: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
  en: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
  de: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
};

const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${p2(Math.round(sec % 60))}`;
function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase(); }
function hue(name: string) { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360; return h; }

export default async function OperatorConsolePage({ searchParams }: { searchParams: Promise<{ period?: string; op?: string }> }) {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.REPORTS) && !canRead(s.role, MODULES.CRM)) {
    return (
      <Forbidden
        title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })}
        body={tr(s.locale, { uz: "Bu bo'lim savdo bo'limi uchun.", ru: "Этот раздел для отдела продаж.", en: "This section is for the sales department.", de: "Dieser Bereich ist für die Verkaufsabteilung." })}
      />
    );
  }
  const locale = s.locale as Locale;
  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const PERIODS = periodsFor(locale);
  const sp = await searchParams;
  const period = (PERIODS.find((p) => p.key === sp.period)?.key ?? "today") as Period;
  const isHead = canRead(s.role, MODULES.REPORTS);
  const opId = isHead && sp.op ? sp.op : s.userId;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const from =
    period === "week" ? new Date(todayStart.getTime() - 6 * 86400000)
    : period === "month" ? new Date(now.getFullYear(), now.getMonth(), 1)
    : period === "year" ? new Date(now.getFullYear(), 0, 1)
    : todayStart;

  const [op, calls, leads, reminders] = await Promise.all([
    // begona operator konsoli faqat faol filial doirasida ochilsin (o'z konsoli doim ochiq)
    prisma.user.findFirst({ where: opId === s.userId ? { id: opId } : { AND: [{ id: opId }, branchWhere(s)] }, select: { fullName: true } }),
    prisma.call.findMany({ where: { operatorId: opId }, select: { direction: true, status: true, duration: true, startedAt: true } }),
    // faol filial doirasida
    prisma.lead.findMany({ where: { AND: [{ managerId: opId }, branchWhere(s)] }, orderBy: { createdAt: "desc" }, select: { id: true, stage: true, fullName: true, phone: true, source: true, createdAt: true } }),
    prisma.task.findMany({ where: { kind: "REMINDER", assigneeId: opId, status: "OPEN" }, orderBy: { dueAt: "asc" }, take: 6, select: { id: true, title: true, dueAt: true } }),
  ]);

  // ── Qo'ng'iroq statistikasi (davr) ──
  const cp = calls.filter((c) => c.startedAt >= from);
  const incoming = cp.filter((c) => c.direction === "INCOMING").length;
  const outgoing = cp.filter((c) => c.direction === "OUTGOING").length;
  const answered = cp.filter((c) => c.status === "ANSWERED").length;
  const missed = cp.filter((c) => c.status === "MISSED" || c.status === "NO_ANSWER").length;
  const talkSec = cp.reduce((n, c) => n + c.duration, 0);
  const totalCalls = cp.length;
  const answeredPct = totalCalls ? Math.round((answered / totalCalls) * 100) : 0;
  const avgDur = answered ? Math.round(talkSec / answered) : 0;

  // ── Lid statistikasi ──
  const assigned = leads.length;
  const newCount = leads.filter((l) => l.stage === "NEW").length;
  const won = leads.filter((l) => l.stage === "WON").length;
  const lost = leads.filter((l) => l.stage === "LOST").length;
  const reprocess = leads.filter((l) => l.stage === "IN_PROGRESS" || l.stage === "CONTACTED").length;
  const worked = leads.filter((l) => l.stage !== "NEW").length;
  const conv = assigned ? Math.round((won / assigned) * 100) : 0;

  // ── Qo'ng'iroq tahlili (breakdown) ──
  const breakdown: [string, number][] = [
    [T("Javob berilgan", "Отвечено", "Answered", "Beantwortet"), answered],
    [T("O'tkazib yuborilgan", "Пропущено", "Missed", "Verpasst"), missed],
    [T("Kiruvchi", "Входящие", "Incoming", "Eingehend"), incoming],
    [T("Chiquvchi", "Исходящие", "Outgoing", "Ausgehend"), outgoing],
  ];
  const maxB = Math.max(1, ...breakdown.map(([, v]) => v));

  // ── Haftalik faoliyat (so'nggi 7 kun) ──
  const dow = DOW[locale] ?? DOW.uz;
  const days: { label: string; calls: number; won: number; worked: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStart.getTime() - i * 86400000);
    const dEnd = new Date(d.getTime() + 86400000);
    days.push({
      label: dow[d.getDay()],
      calls: calls.filter((c) => c.startedAt >= d && c.startedAt < dEnd).length,
      won: leads.filter((l) => l.stage === "WON" && l.createdAt >= d && l.createdAt < dEnd).length,
      worked: leads.filter((l) => l.createdAt >= d && l.createdAt < dEnd).length,
    });
  }
  const maxDay = Math.max(1, ...days.map((d) => Math.max(d.calls, d.won, d.worked)));

  const recentLeads = leads.slice(0, 6);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-white"><Icon name="headphones" className="h-6 w-6" /></div>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{T("Operator Dashboard", "Панель оператора", "Operator Dashboard", "Operator-Dashboard")}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{op?.fullName ?? T("Operator", "Оператор", "Operator", "Operator")} · {T("kunlik statistika va ko'rsatkichlar", "ежедневная статистика и показатели", "daily statistics and metrics", "tägliche Statistik und Kennzahlen")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-1 dark:border-slate-700 dark:bg-slate-800/40">
          {PERIODS.map((p) => (
            <Link key={p.key} href={`/operator?period=${p.key}${isHead && sp.op ? `&op=${sp.op}` : ""}`}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${period === p.key ? "bg-brand-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}>{p.label}</Link>
          ))}
        </div>
      </div>

      {/* Qo'ng'iroq tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon="arrowDownLeft" tone="brand" value={incoming} label={T("Kiruvchi qo'ng'iroqlar", "Входящие звонки", "Incoming calls", "Eingehende Anrufe")} />
        <Tile icon="arrowUpRight" tone="violet" value={outgoing} label={T("Chiquvchi qo'ng'iroqlar", "Исходящие звонки", "Outgoing calls", "Ausgehende Anrufe")} />
        <Tile icon="check" tone="green" value={answered} label={T("Javob berilgan", "Отвечено", "Answered", "Beantwortet")} />
        <Tile icon="clock" tone="amber" value={`${Math.round(talkSec / 60)} ${T("daq", "мин", "min", "Min.")}`} label={T("Gaplashilgan vaqt", "Время разговора", "Talk time", "Gesprächszeit")} />
      </div>

      {/* Tahlil + Ko'rsatkichlar */}
      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,380px)]">
        <Panel icon="chart" title={T("Qo'ng'iroqlar tahlili", "Анализ звонков", "Call analysis", "Anrufanalyse")}>
          {totalCalls === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-400">{T("Ma'lumot yo'q", "Нет данных", "No data", "Keine Daten")}</div>
          ) : (
            <div className="space-y-3 pt-1">
              {breakdown.map(([lbl, v]) => (
                <div key={lbl}>
                  <div className="mb-1 flex justify-between text-xs"><span className="text-slate-600 dark:text-slate-300">{lbl}</span><span className="font-semibold text-slate-700 dark:text-slate-200">{v}</span></div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(v / maxB) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel icon="chart" title={T("Ko'rsatkichlar", "Показатели", "Metrics", "Kennzahlen")}>
          <div className="space-y-4 pt-1">
            <Metric label={T("Javob berilgan", "Отвечено", "Answered", "Beantwortet")} pct={answeredPct} tone="emerald" />
            <Metric label={T("Konversiya (KPI)", "Конверсия (KPI)", "Conversion (KPI)", "Konversion (KPI)")} pct={conv} tone="brand" />
            <div className="grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
              <Mini value={totalCalls} label={T("Jami qo'ng'iroq", "Всего звонков", "Total calls", "Anrufe gesamt")} />
              <Mini value={missed} label={T("O'tkazib yuborilgan", "Пропущено", "Missed", "Verpasst")} />
              <Mini value={mmss(avgDur)} label={T("O'rtacha davomiylik", "Средняя длительность", "Average duration", "Durchschnittliche Dauer")} />
              <Mini value={assigned} label={T("Boshlangan lidlar", "Начатые лиды", "Started leads", "Begonnene Leads")} />
            </div>
          </div>
        </Panel>
      </div>

      {/* Lid tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon="download" tone="brand" value={assigned} label={T("Tayinlangan lidlar", "Назначенные лиды", "Assigned leads", "Zugewiesene Leads")} delta={`${newCount} ${T("yangi", "новых", "new", "neu")}`} />
        <Tile icon="check" tone="green" value={won} label={T("Muvaffaqiyatli", "Успешные", "Successful", "Erfolgreich")} delta={`${conv}%`} />
        <Tile icon="phoneMissed" tone="amber" value={missed} label={T("Javob yo'q", "Нет ответа", "No answer", "Keine Antwort")} delta={`${reprocess} ${T("qayta", "повторно", "retry", "erneut")}`} />
        <Tile icon="eye" tone="violet" value={worked} label={T("Ishlangan lidlar", "Обработанные лиды", "Processed leads", "Bearbeitete Leads")} delta={`${lost} ${T("bloklangan", "заблокировано", "blocked", "blockiert")}`} />
      </div>

      {/* Haftalik faoliyat */}
      <Panel
        icon="chart"
        title={T("Haftalik faoliyat", "Недельная активность", "Weekly activity", "Wöchentliche Aktivität")}
        legend={[
          [T("Ishlangan", "Обработано", "Processed", "Bearbeitet"), "bg-brand-500"],
          [T("Muvaffaqiyatli", "Успешные", "Successful", "Erfolgreich"), "bg-emerald-500"],
          [T("Qo'ng'iroqlar", "Звонки", "Calls", "Anrufe"), "bg-amber-500"],
        ]}
      >
        <div className="flex h-52 items-end gap-2 pt-2">
          {days.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-44 w-full items-end justify-center gap-0.5">
                <Bar v={d.worked} max={maxDay} cls="bg-brand-500" />
                <Bar v={d.won} max={maxDay} cls="bg-emerald-500" />
                <Bar v={d.calls} max={maxDay} cls="bg-amber-500" />
              </div>
              <span className="text-[11px] text-slate-400">{d.label}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Eslatmalar + So'nggi lidlar */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4 dark:border-slate-800">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-700 dark:text-slate-200"><Icon name="bell" className="h-5 w-5 text-amber-500" /> {T("Eslatmalar", "Напоминания", "Reminders", "Erinnerungen")}</h2>
            <Link href="/reminders" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">{T("Barchasi", "Все", "All", "Alle")}</Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {reminders.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-400">{T("Eslatmalar yo'q", "Напоминаний нет", "No reminders", "Keine Erinnerungen")}</div>
            ) : reminders.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                <Icon name="bell" className="h-4 w-4 shrink-0 text-amber-400" />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{r.title}</span>
                {r.dueAt && <span className="text-xs text-slate-400">{fmtDate(r.dueAt)}</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4 dark:border-slate-800">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-700 dark:text-slate-200"><Icon name="users" className="h-5 w-5 text-brand-500" /> {T("So'nggi lidlar", "Последние лиды", "Recent leads", "Letzte Leads")}</h2>
            <Link href="/crm" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">{T("Barchasi", "Все", "All", "Alle")}</Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentLeads.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-400">{T("Hozircha lidlar yo'q", "Лидов пока нет", "No leads yet", "Noch keine Leads")}</div>
            ) : recentLeads.map((l) => (
              <Link key={l.id} href={`/crm/${l.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: `hsl(${hue(l.fullName)} 60% 55%)` }}>{initials(l.fullName)}</span>
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{l.fullName}</div><div className="truncate text-xs text-slate-400">{l.phone}</div></div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{label(LEAD_STAGE_LABELS, l.stage, locale)}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const iconTone: Record<string, string> = {
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
  green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
};

function Tile({ icon, tone, value, label, delta }: { icon: string; tone: string; value: string | number; label: string; delta?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card transition hover:shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconTone[tone] ?? iconTone.brand}`}><Icon name={icon} className="h-5 w-5" /></div>
        {delta && <span className="text-xs font-semibold text-slate-400">{delta}</span>}
      </div>
      <div className="mt-3 text-[30px] font-bold leading-none tracking-tight text-slate-900 dark:text-slate-100">{value}</div>
      <div className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}

function Panel({ icon, title, legend, children }: { icon: string; title: string; legend?: [string, string][]; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-700 dark:text-slate-200"><Icon name={icon} className="h-5 w-5 text-brand-500" /> {title}</h2>
        {legend && <div className="flex flex-wrap gap-3">{legend.map(([l, c]) => <span key={l} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><span className={`h-2.5 w-2.5 rounded-full ${c}`} /> {l}</span>)}</div>}
      </div>
      {children}
    </div>
  );
}

function Metric({ label, pct, tone }: { label: string; pct: number; tone: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-300">{label}</span><span className={`font-bold ${tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-brand-600 dark:text-brand-300"}`}>{pct}%</span></div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${tone === "emerald" ? "bg-emerald-500" : "bg-brand-500"}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
    </div>
  );
}

function Mini({ value, label }: { value: string | number; label: string }) {
  return <div className="rounded-lg bg-slate-50/70 px-3 py-2 dark:bg-slate-800/40"><div className="text-lg font-bold text-slate-800 dark:text-slate-100">{value}</div><div className="text-[11px] text-slate-400">{label}</div></div>;
}

function Bar({ v, max, cls }: { v: number; max: number; cls: string }) {
  return <div className={`w-2 rounded-t ${cls}`} style={{ height: `${Math.max(2, (v / max) * 168)}px` }} title={String(v)} />;
}
