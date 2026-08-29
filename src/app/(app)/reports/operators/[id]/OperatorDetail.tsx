"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import { formatMoney, type Locale } from "@/lib/constants";
import { Icon } from "../../../_components/Icon";
import UserAvatar from "../../../_components/UserAvatar";
import DateFilter from "../DateFilter";
import LeadList from "./LeadList";
import CallsTable from "./CallsTable";

export interface DOperator {
  id: string; name: string; email: string; phone: string | null; sip: string | null;
  avatar: string | null; position: string | null; branch: string | null; isActive: boolean;
  password: string | null; fiksa: number; kpiBonus: number; createdAt: string; lastLoginAt: string | null;
}
export interface DActivity { id: string; type: string; result: string | null; author: string | null; date: string }
export interface DLead {
  id: string; name: string; phone: string; stage: string; source: string | null; note: string | null;
  course: string | null; budget: number | null; createdAt: string; updatedAt: string;
  calls: number; answered: number; talkSec: number; talked: boolean; noAnswer: boolean;
  activities: DActivity[];
}
export interface DCall {
  id: string; direction: string; status: string; leadId: string | null; contact: string | null;
  phone: string; duration: number; recordingUrl: string | null; comment: string | null;
  date: string; time: string;
}
export interface DMonth { key: string; label: string; won: number; bonus: number; fiksa: number; total: number; current: boolean }
export interface DStats {
  total: number; won: number; lost: number; fresh: number; missedCalls: number;
  conv: number; callsTotal: number; answered: number; talkSec: number;
}

const kpiColor = (v: number) => (v >= 35 ? "#10b981" : v >= 25 ? "#f59e0b" : "#ef4444");
const fmtDur = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), sc = sec % 60;
  const p2 = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p2(m)}:${p2(sc)}` : `${m}:${p2(sc)}`;
};
// Deterministik raqam guruhlash (Intl o'rniga — server/client bir xil chiqishi uchun)
const grp = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

type Tab = "all" | "talked" | "no_answer" | "calls";

interface Props {
  locale: Locale;
  op: DOperator;
  leads: DLead[];
  calls: DCall[];
  months: DMonth[];
  period: "all" | "today" | "month" | "year" | "custom";
  customDate: string | null;
  customDateLabel: string | null;
  stats: DStats;
}

export default function OperatorDetail({ locale, op, leads, calls, months, period, customDate, customDateLabel, stats }: Props) {
  const [tab, setTab] = useState<Tab>("all");

  const talked = useMemo(() => leads.filter((l) => l.talked), [leads]);
  const noAnswer = useMemo(() => leads.filter((l) => l.noAnswer), [leads]);
  const shownLeads = tab === "talked" ? talked : tab === "no_answer" ? noAnswer : leads;

  const cur = months.find((m) => m.current);
  const prev = months.filter((m) => !m.current && m.won > 0);

  const periods: { k: Props["period"]; label: string }[] = [
    { k: "all", label: tr(locale, { uz: "Barchasi", ru: "Все", en: "All", de: "Alle" }) },
    { k: "today", label: tr(locale, { uz: "Bugun", ru: "Сегодня", en: "Today", de: "Heute" }) },
    { k: "month", label: tr(locale, { uz: "Shu oy", ru: "Этот месяц", en: "This month", de: "Dieser Monat" }) },
    { k: "year", label: tr(locale, { uz: "Shu yil", ru: "Этот год", en: "This year", de: "Dieses Jahr" }) },
  ];

  return (
    <div className="space-y-4">
      {/* Sarlavha + davr filtri */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/reports/operators" className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
            <Icon name="arrow" className="h-4 w-4 rotate-180" />
          </Link>
          <UserAvatar name={op.name} imageUrl={op.avatar} role="MANAGER" size="lg" />
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{op.name}</h1>
            <p className="text-sm text-slate-400">
              {op.position || tr(locale, { uz: "Operator profili", ru: "Профиль оператора", en: "Operator profile", de: "Operatorprofil" })}
              {op.branch && <span className="ml-1.5">• {op.branch}</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {periods.map((p) => (
            <Link
              key={p.k}
              href={`/reports/operators/${op.id}?period=${p.k}`}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                period === p.k ? "bg-brand-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
            >
              {p.label}
            </Link>
          ))}
          <DateFilter locale={locale} value={customDate} label={customDateLabel} />
        </div>
      </div>

      {/* Profil / Konversiya / Statistika */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
              <Icon name="headphones" className="h-6 w-6" />
            </span>
            <div>
              <h2 className="font-bold text-slate-800 dark:text-slate-100">{op.name}</h2>
              <span className={cn(
                "mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                op.isActive
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30"
                  : "bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700"
              )}>
                {op.isActive ? tr(locale, { uz: "Faol", ru: "Активен", en: "Active", de: "Aktiv" }) : tr(locale, { uz: "Nofaol", ru: "Неактивен", en: "Inactive", de: "Inaktiv" })}
              </span>
            </div>
          </div>
          <div className="space-y-2.5 text-sm text-slate-500 dark:text-slate-400">
            <InfoRow icon="mail" value={op.email} />
            <InfoRow icon="phone" value={op.phone || "—"} />
            {op.sip && <InfoRow icon="headphones" value={`SIP: ${op.sip}`} />}
            <InfoRow icon="calendar" value={`${tr(locale, { uz: "Yaratilgan", ru: "Создан", en: "Created", de: "Erstellt" })}: ${op.createdAt}`} />
            <InfoRow icon="clock" value={`${tr(locale, { uz: "Oxirgi kirish", ru: "Последний вход", en: "Last login", de: "Letzte Anmeldung" })}: ${op.lastLoginAt ?? tr(locale, { uz: "hech qachon", ru: "никогда", en: "never", de: "nie" })}`} />
            {op.password && <InfoRow icon="shield" value={`${tr(locale, { uz: "Parol", ru: "Пароль", en: "Password", de: "Passwort" })}: ${op.password}`} mono />}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <Icon name="chart" className="h-5 w-5 text-slate-400" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Konversiya", ru: "Конверсия", en: "Conversion", de: "Konversion" })}</h3>
          </div>
          <div className="mb-4 text-center">
            <div className="text-5xl font-bold" style={{ color: kpiColor(stats.conv) }}>{stats.conv}%</div>
            <div className="mt-1 text-sm text-slate-400">{tr(locale, { uz: "Muvaffaqiyat darajasi", ru: "Уровень успеха", en: "Success rate", de: "Erfolgsquote" })}</div>
          </div>
          <div className="mb-4 h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, stats.conv)}%`, background: kpiColor(stats.conv) }} />
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            {[["#ef4444", "0-25%"], ["#f59e0b", "25-35%"], ["#10b981", "35%+"]].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: c }} /> {l}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
            <Icon name="chart" className="h-5 w-5 text-slate-400" /> {tr(locale, { uz: "Statistika", ru: "Статистика", en: "Statistics", de: "Statistik" })}
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            <Mini value={stats.fresh} label={tr(locale, { uz: "Yangi", ru: "Новые", en: "New", de: "Neu" })} tone="#3b82f6" />
            <Mini value={stats.won} label={tr(locale, { uz: "Muvaffaqiyatli", ru: "Успешные", en: "Successful", de: "Erfolgreich" })} tone="#10b981" />
            <Mini value={stats.lost} label={tr(locale, { uz: "Yo'qotilgan", ru: "Потерянные", en: "Lost", de: "Verloren" })} tone="#ef4444" />
            <Mini value={stats.missedCalls} label={tr(locale, { uz: "Javobsiz qo'ng'iroq", ru: "Без ответа", en: "No answer", de: "Ohne Antwort" })} tone="#f59e0b" />
            <div className="col-span-2">
              <Mini value={stats.total} label={tr(locale, { uz: "Jami lidlar", ru: "Всего лидов", en: "Total leads", de: "Leads gesamt" })} tone="#8b5cf6" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400 dark:border-slate-800">
            <span>{tr(locale, { uz: "Qo'ng'iroqlar", ru: "Звонки", en: "Calls", de: "Anrufe" })}: <b className="text-slate-600 dark:text-slate-300">{stats.callsTotal}</b></span>
            <span>{tr(locale, { uz: "Gaplashgan", ru: "Наговорено", en: "Talk time", de: "Gesprächszeit" })}: <b className="text-slate-600 dark:text-slate-300">{fmtDur(stats.talkSec)}</b></span>
          </div>
        </div>
      </div>

      {/* Oylik maosh */}
      {cur && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h2 className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
              <Icon name="wallet" className="h-5 w-5 text-violet-500" /> {tr(locale, { uz: "Oylik maosh", ru: "Месячная зарплата", en: "Monthly salary", de: "Monatsgehalt" })}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {tr(locale, { uz: "Fiksa va KPI bonus — muvaffaqiyatli lidlar bo'yicha", ru: "Фикса и KPI бонус — по успешным лидам", en: "Fixed salary and KPI bonus — based on successful leads", de: "Festgehalt und KPI-Bonus — basierend auf erfolgreichen Leads" })}
            </p>
          </div>
          <div className="p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Pay icon="coins" tone="#8b5cf6" label={tr(locale, { uz: "Fiksa maosh", ru: "Фикса", en: "Fixed salary", de: "Festgehalt" })} value={formatMoney(cur.fiksa, locale)} />
              <Pay
                icon="chart"
                tone="#f97316"
                label={`${tr(locale, { uz: "KPI bonus", ru: "KPI бонус", en: "KPI bonus", de: "KPI-Bonus" })} (${cur.label})`}
                value={formatMoney(cur.bonus, locale)}
                hint={`${tr(locale, { uz: "Muvaffaqiyatli lidlar", ru: "Успешные лиды", en: "Successful leads", de: "Erfolgreiche Leads" })}: ${cur.won} → ${formatMoney(cur.won * cur.bonus, locale)}`}
              />
              <Pay
                icon="award"
                tone="#10b981"
                label={`${tr(locale, { uz: "Jami oylik", ru: "Итого за месяц", en: "Monthly total", de: "Monatssumme" })} (${cur.label})`}
                value={formatMoney(cur.total, locale)}
                hint={`${grp(cur.fiksa)} + ${cur.won} × ${grp(cur.bonus)}`}
                accent
              />
            </div>

            {prev.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-400">
                  <Icon name="calendar" className="h-4 w-4" /> {tr(locale, { uz: "Oldingi oylar", ru: "Прошлые месяцы", en: "Previous months", de: "Vorherige Monate" })}
                </h3>
                <div className="space-y-2">
                  {prev.map((m) => (
                    <div key={m.key} className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-white/[0.03]">
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{m.label}</p>
                        <p className="text-xs text-slate-400">
                          {tr(locale, { uz: "Muvaffaqiyatli lidlar", ru: "Успешные лиды", en: "Successful leads", de: "Erfolgreiche Leads" })}: <b className="text-emerald-600 dark:text-emerald-400">{m.won}</b>
                        </p>
                      </div>
                      <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(m.total, locale)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tablar */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex overflow-x-auto border-b border-slate-100 dark:border-slate-800">
          <TabBtn active={tab === "all"} onClick={() => setTab("all")} icon="user" label={tr(locale, { uz: "Barcha lidlar", ru: "Все лиды", en: "All leads", de: "Alle Leads" })} count={leads.length} tone="slate" />
          <TabBtn active={tab === "talked"} onClick={() => setTab("talked")} icon="phoneCall" label={tr(locale, { uz: "Gaplashilgan", ru: "Поговорили", en: "Talked", de: "Erreicht" })} count={talked.length} tone="emerald" />
          <TabBtn active={tab === "no_answer"} onClick={() => setTab("no_answer")} icon="phoneOff" label={tr(locale, { uz: "Javob bermadi", ru: "Не ответили", en: "No answer", de: "Nicht abgenommen" })} count={noAnswer.length} tone="red" />
          <TabBtn active={tab === "calls"} onClick={() => setTab("calls")} icon="phone" label={tr(locale, { uz: "Qo'ng'iroqlar tarixi", ru: "История звонков", en: "Call history", de: "Anrufverlauf" })} count={calls.length} tone="blue" />
        </div>
        {tab === "calls"
          ? <CallsTable locale={locale} calls={calls} />
          : <LeadList locale={locale} leads={shownLeads} />}
      </div>
    </div>
  );
}

function InfoRow({ icon, value, mono }: { icon: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Icon name={icon} className="h-4 w-4 shrink-0 text-slate-400" />
      <span className={cn("truncate", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}

function Mini({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: `${tone}14` }}>
      <div className="text-2xl font-bold" style={{ color: tone }}>{value}</div>
      <div className="text-[11px] text-slate-400">{label}</div>
    </div>
  );
}

function Pay({ icon, tone, label, value, hint, accent }: { icon: string; tone: string; label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-4", accent ? "border-emerald-500/25 bg-emerald-500/[0.06]" : "border-slate-200/70 bg-slate-50 dark:border-slate-800 dark:bg-white/[0.03]")}>
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${tone}1a`, color: tone }}>
          <Icon name={icon} className="h-4 w-4" />
        </span>
        <span className="text-xs font-medium text-slate-400">{label}</span>
      </div>
      <p className="text-xl font-bold tabular-nums" style={accent ? { color: tone } : undefined}>
        <span className={accent ? "" : "text-slate-800 dark:text-slate-100"}>{value}</span>
      </p>
      {hint && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

const tabTone: Record<string, string> = {
  slate: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  red: "bg-red-500/15 text-red-600 dark:text-red-400",
  blue: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
};

function TabBtn({ active, onClick, icon, label, count, tone }: { active: boolean; onClick: () => void; icon: string; label: string; count: number; tone: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium transition",
        active ? "border-b-2 border-brand-500 bg-brand-50/60 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
      )}
    >
      <Icon name={icon} className="h-4 w-4" /> {label}
      <span className={cn("rounded-full px-2 py-0.5 text-xs", tabTone[tone])}>{count}</span>
    </button>
  );
}
