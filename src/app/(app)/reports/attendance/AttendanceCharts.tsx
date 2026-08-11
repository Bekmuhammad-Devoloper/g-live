"use client";

import { useMemo, useState } from "react";
import { Icon } from "../../_components/Icon";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";

export interface StatusSlice { key: string; label: string; count: number; color: string }
export interface DayPoint { date: string; present: number; absent: number }

interface Props {
  locale: Locale;
  total: number;
  attended: number;
  absentOnly: number;
  bosh: number;
  rate: number;
  totalPresent: number;
  totalAbsent: number;
  statuses: StatusSlice[];
  daily: DayPoint[];
}

// Status/kategoriya ranglari (validator: ΔE≥8, ko'rinadigan yorliqlar bilan)
const C = { green: "#10b981", rose: "#ef4444", slate: "#94a3b8" };
// Deterministik (server=client) — toLocaleString ICU farqi hydration xatosi beradi
const nf = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const dm = (isoStr: string) => { const [, m, d] = isoStr.split("-"); return `${d}.${m}`; };

export default function AttendanceCharts(p: Props) {
  return (
    <div className="space-y-5">
      {/* KPI kartalar */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label={tr(p.locale, { uz: "Jami o'quvchilar", ru: "Всего учеников", en: "Total students" })} value={nf(p.total)} icon="graduation" tone="brand" />
        <Kpi label={tr(p.locale, { uz: "Davomat foizi", ru: "Посещаемость", en: "Attendance rate" })} value={`${p.rate}%`} icon="chart" tone="green" hint={`${nf(p.totalPresent)} / ${nf(p.totalPresent + p.totalAbsent)}`} />
        <Kpi label={tr(p.locale, { uz: "Kelganlar (belgi)", ru: "Присутствия", en: "Present marks" })} value={nf(p.totalPresent)} icon="check" tone="green" />
        <Kpi label={tr(p.locale, { uz: "Kelmaganlar (belgi)", ru: "Отсутствия", en: "Absent marks" })} value={nf(p.totalAbsent)} icon="fileX" tone="rose" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Donut: o'quvchilar taqsimoti */}
        <ChartCard title={tr(p.locale, { uz: "O'quvchilar taqsimoti", ru: "Распределение учеников", en: "Student distribution" })}>
          <Donut
            locale={p.locale}
            total={p.total}
            slices={[
              { key: "att", label: tr(p.locale, { uz: "Kelgan", ru: "Присутствовали", en: "Attended" }), count: p.attended, color: C.green },
              { key: "abs", label: tr(p.locale, { uz: "Faqat kelmagan", ru: "Только отсутствия", en: "Absent only" }), count: p.absentOnly, color: C.rose },
              { key: "empty", label: tr(p.locale, { uz: "Davomat bo'sh", ru: "Нет посещаемости", en: "No attendance" }), count: p.bosh, color: C.slate },
            ]}
          />
        </ChartCard>

        {/* Status taqsimoti (gorizontal bar) */}
        <ChartCard title={tr(p.locale, { uz: "Davomat holatlari bo'yicha", ru: "По статусам посещаемости", en: "By attendance status" })}>
          <StatusBars locale={p.locale} statuses={p.statuses} />
        </ChartCard>
      </div>

      {/* Kunlik davomat (stacked bar) */}
      <ChartCard title={tr(p.locale, { uz: "Kunlik davomat", ru: "Посещаемость по дням", en: "Daily attendance" })}>
        <DailyBars locale={p.locale} daily={p.daily} />
      </ChartCard>
    </div>
  );
}

/* ── KPI tile ── */
function Kpi({ label, value, icon, tone, hint }: { label: string; value: string; icon: string; tone: "brand" | "green" | "rose"; hint?: string }) {
  const t = { brand: "text-brand-600 bg-brand-500/10", green: "text-emerald-600 bg-emerald-500/10", rose: "text-rose-500 bg-rose-500/10" }[tone];
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</div>
          <div className="mt-1.5 whitespace-nowrap text-[24px] font-bold leading-none tracking-tight text-slate-800 dark:text-slate-100">{value}</div>
          {hint && <div className="mt-1.5 text-xs text-slate-400">{hint}</div>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t}`}><Icon name={icon} className="h-5 w-5" /></div>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      {children}
    </div>
  );
}

/* ── Donut ── */
function Donut({ locale, total, slices }: { locale: Locale; total: number; slices: StatusSlice[] }) {
  const R = 42, SW = 16, CIRC = 2 * Math.PI * R, GAP = total > 0 ? 2 : 0;
  const shown = slices.filter((s) => s.count > 0);
  let acc = 0;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative h-[168px] w-[168px] shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={R} fill="none" strokeWidth={SW} className="stroke-slate-100 dark:stroke-slate-800" />
          {total > 0 && shown.map((s) => {
            const frac = s.count / total;
            const len = Math.max(0, frac * CIRC - GAP);
            const off = -acc * CIRC;
            acc += frac;
            return (
              <circle key={s.key} cx="60" cy="60" r={R} fill="none" stroke={s.color} strokeWidth={SW} strokeLinecap="round"
                strokeDasharray={`${len} ${CIRC - len}`} strokeDashoffset={off}>
                <title>{`${s.label}: ${nf(s.count)} (${Math.round(frac * 100)}%)`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{nf(total)}</div>
          <div className="text-[11px] text-slate-400">{tr(locale, { uz: "o'quvchi", ru: "учеников", en: "students" })}</div>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-2.5 text-sm">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="flex-1 text-slate-600 dark:text-slate-300">{s.label}</span>
            <span className="font-bold tabular-nums text-slate-800 dark:text-slate-100">{nf(s.count)}</span>
            <span className="w-10 text-right text-xs tabular-nums text-slate-400">{total > 0 ? Math.round((s.count / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Status gorizontal bar ── */
function StatusBars({ locale, statuses }: { locale: Locale; statuses: StatusSlice[] }) {
  const data = statuses.filter((s) => s.count > 0);
  const max = Math.max(1, ...data.map((s) => s.count));
  if (data.length === 0) return <Empty locale={locale} />;
  return (
    <ul className="space-y-3">
      {data.map((s) => (
        <li key={s.key}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600 dark:text-slate-300">{s.label}</span>
            <span className="font-bold tabular-nums text-slate-700 dark:text-slate-200">{nf(s.count)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full rounded-full" style={{ width: `${(s.count / max) * 100}%`, background: s.color }} title={`${s.label}: ${nf(s.count)}`} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ── Kunlik stacked bar ── */
function DailyBars({ locale, daily }: { locale: Locale; daily: DayPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const data = useMemo(() => daily, [daily]);
  const max = Math.max(1, ...data.map((d) => d.present + d.absent));
  if (data.length === 0 || data.every((d) => d.present + d.absent === 0)) return <Empty locale={locale} />;

  const H = 160;
  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C.green }} /> {tr(locale, { uz: "Kelgan", ru: "Присутствия", en: "Present" })}</span>
        <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C.rose }} /> {tr(locale, { uz: "Kelmagan", ru: "Отсутствия", en: "Absent" })}</span>
      </div>
      <div className="overflow-x-auto">
        <div className="relative flex items-end gap-1.5" style={{ height: H, minWidth: Math.max(0, data.length * 18) }}>
          {data.map((d, i) => {
            const tot = d.present + d.absent;
            const pH = (d.present / max) * (H - 20);
            const aH = (d.absent / max) * (H - 20);
            return (
              <div key={d.date} className="group relative flex flex-1 flex-col items-center justify-end" style={{ minWidth: 12 }}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                {hover === i && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg bg-slate-800 px-2 py-1 text-[11px] font-medium text-white shadow-lg dark:bg-slate-700">
                    <div className="text-slate-300">{dm(d.date)}</div>
                    <div style={{ color: C.green }}>● {tr(locale, { uz: "Kelgan", ru: "Присут.", en: "Present" })}: {d.present}</div>
                    <div style={{ color: "#fca5a5" }}>● {tr(locale, { uz: "Kelmagan", ru: "Отсут.", en: "Absent" })}: {d.absent}</div>
                  </div>
                )}
                <div className="flex w-full max-w-[26px] flex-col justify-end overflow-hidden rounded-md transition group-hover:opacity-80" style={{ height: Math.max(2, pH + aH) }}>
                  {d.absent > 0 && <div style={{ height: aH, background: C.rose }} />}
                  {d.present > 0 && <div style={{ height: pH, background: C.green, marginTop: d.absent > 0 ? 2 : 0 }} />}
                  {tot === 0 && <div className="h-0.5 bg-slate-200 dark:bg-slate-700" />}
                </div>
                {data.length <= 31 && <span className="mt-1 text-[9px] tabular-nums text-slate-400">{dm(d.date).slice(0, 2)}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Empty({ locale }: { locale: Locale }) {
  return <div className="py-10 text-center text-sm text-slate-400">{tr(locale, { uz: "Bu davr uchun davomat ma'lumoti yo'q", ru: "Нет данных за период", en: "No attendance data for this period" })}</div>;
}
