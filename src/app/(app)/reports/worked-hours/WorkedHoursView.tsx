"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { exportRows, printPage } from "@/lib/export";
import { Icon } from "../../_components/Icon";

export interface WLesson {
  teacher: string;
  room: string;
  course: string;
  startsAt: string; // ISO
  hours: number;
}

interface Props {
  lessons: WLesson[];
  defaultFrom: string; // YYYY-MM-DD
  defaultTo: string;
  locale: Locale;
}

type Dim = "teacher" | "room" | "course";
type Period = "day" | "week" | "month" | "quarter" | "year";
type Tr = { uz: string; ru: string; en: string };

const DIMS: { key: Dim; label: Tr }[] = [
  { key: "teacher", label: { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" } },
  { key: "room", label: { uz: "Xona", ru: "Кабинет", en: "Room" } },
  { key: "course", label: { uz: "Kurs", ru: "Курс", en: "Course" } },
];
const PERIODS: { key: Period; label: Tr }[] = [
  { key: "day", label: { uz: "Kun", ru: "День", en: "Day" } },
  { key: "week", label: { uz: "Hafta", ru: "Неделя", en: "Week" } },
  { key: "month", label: { uz: "Oy", ru: "Месяц", en: "Month" } },
  { key: "quarter", label: { uz: "Chorak yil", ru: "Квартал", en: "Quarter" } },
  { key: "year", label: { uz: "Yil", ru: "Год", en: "Year" } },
];

const p2 = (n: number) => String(n).padStart(2, "0");
const fmtHours = (h: number) => (h === 0 ? "—" : h % 1 === 0 ? String(h) : h.toFixed(1));

// Davr bucketlarini [from,to] oralig'ida yaratish
function buildBuckets(from: string, to: string, period: Period, locale: Locale) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const out: { key: string; label: string; start: number; end: number }[] = [];
  const cur = new Date(start);
  let guard = 0;
  while (cur <= end && guard++ < 500) {
    const s = new Date(cur);
    let e: Date, key: string, label: string;
    if (period === "day") {
      e = new Date(cur); e.setDate(cur.getDate() + 1);
      key = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`;
      label = `${p2(cur.getDate())}.${p2(cur.getMonth() + 1)}`;
      cur.setDate(cur.getDate() + 1);
    } else if (period === "week") {
      e = new Date(cur); e.setDate(cur.getDate() + 7);
      key = `w${s.getTime()}`;
      label = `${p2(cur.getDate())}.${p2(cur.getMonth() + 1)}`;
      cur.setDate(cur.getDate() + 7);
    } else if (period === "month") {
      e = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      key = `${cur.getFullYear()}-${cur.getMonth()}`;
      label = `${p2(cur.getMonth() + 1)}.${String(cur.getFullYear()).slice(2)}`;
      cur.setMonth(cur.getMonth() + 1, 1);
    } else if (period === "quarter") {
      const q = Math.floor(cur.getMonth() / 3);
      e = new Date(cur.getFullYear(), q * 3 + 3, 1);
      key = `${cur.getFullYear()}-q${q}`;
      const yy = String(cur.getFullYear()).slice(2);
      label = tr(locale, { uz: `${q + 1}-chorak '${yy}`, ru: `${q + 1} кв. '${yy}`, en: `Q${q + 1} '${yy}` });
      cur.setMonth(q * 3 + 3, 1);
    } else {
      e = new Date(cur.getFullYear() + 1, 0, 1);
      key = `${cur.getFullYear()}`;
      label = `${cur.getFullYear()}`;
      cur.setFullYear(cur.getFullYear() + 1, 0, 1);
    }
    out.push({ key, label, start: s.getTime(), end: e.getTime() });
  }
  return out;
}

export default function WorkedHoursView({ lessons, defaultFrom, defaultTo, locale }: Props) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [dim, setDim] = useState<Dim>("teacher");
  const [period, setPeriod] = useState<Period>("day");
  const [listView, setListView] = useState(false);

  const dimVal = (l: WLesson) => (dim === "teacher" ? l.teacher : dim === "room" ? l.room : l.course);

  const filtered = useMemo(() => {
    const f = new Date(`${from}T00:00:00`).getTime();
    const t = new Date(`${to}T23:59:59`).getTime();
    return lessons.filter((l) => {
      const x = new Date(l.startsAt).getTime();
      return x >= f && x <= t;
    });
  }, [lessons, from, to]);

  const buckets = useMemo(() => buildBuckets(from, to, period, locale), [from, to, period, locale]);

  const { rows, colTotals, grand } = useMemo(() => {
    const rowMap = new Map<string, Record<string, number>>();
    const colTotals: Record<string, number> = {};
    let grand = 0;
    for (const l of filtered) {
      const rk = dimVal(l);
      const b = buckets.find((bk) => new Date(l.startsAt).getTime() >= bk.start && new Date(l.startsAt).getTime() < bk.end);
      if (!b) continue;
      const row = rowMap.get(rk) ?? {};
      row[b.key] = (row[b.key] ?? 0) + l.hours;
      rowMap.set(rk, row);
      colTotals[b.key] = (colTotals[b.key] ?? 0) + l.hours;
      grand += l.hours;
    }
    const rows = [...rowMap.entries()]
      .map(([name, cells]) => ({ name, cells, total: Object.values(cells).reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total);
    return { rows, colTotals, grand };
  }, [filtered, buckets, dim]);

  const dimLabel = tr(locale, DIMS.find((d) => d.key === dim)!.label);
  const isEmpty = rows.length === 0;

  const doExport = () => {
    const columns = [
      { key: "name", label: dimLabel },
      ...buckets.map((b) => ({ key: b.key, label: b.label })),
      { key: "__total", label: tr(locale, { uz: "Jami", ru: "Итого", en: "Total" }) },
    ];
    const data = rows.map((r) => {
      const rec: Record<string, string | number> = { name: r.name, __total: r.total };
      for (const b of buckets) rec[b.key] = r.cells[b.key] ?? 0;
      return rec;
    });
    exportRows("ishlab-berilgan-soatlar", columns, data);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "O'quv markazga ishlab berilgan soatlar", ru: "Часы, отработанные для учебного центра", en: "Hours worked for the learning center" })}</h1>
          {isEmpty && <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">{tr(locale, { uz: "Ma'lumotlar topilmadi", ru: "Данные не найдены", en: "No data found" })}</p>}
          {!isEmpty && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Jami", ru: "Итого", en: "Total" })}: <span className="font-semibold text-slate-700 dark:text-slate-200">{fmtHours(grand)} {tr(locale, { uz: "soat", ru: "ч", en: "h" })}</span></p>}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setListView((v) => !v)}
            className={cn("flex h-10 w-10 items-center justify-center rounded-lg border transition", listView ? "border-brand-300 bg-brand-50 text-brand-600 dark:border-brand-500/40 dark:bg-brand-950/40" : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800")}
            title={listView ? tr(locale, { uz: "Jadval ko'rinishi", ru: "Табличный вид", en: "Table view" }) : tr(locale, { uz: "Ro'yxat ko'rinishi", ru: "Список", en: "List view" })}
          >
            <Icon name="listView" className="h-5 w-5" />
          </button>
          <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
            <Icon name="calendar" className="h-4 w-4 text-slate-400" />
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[112px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
            <span className="text-slate-300">–</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[112px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
          </div>
          <Sel value={dim} onChange={(v) => setDim(v as Dim)}>
            {DIMS.map((d) => <option key={d.key} value={d.key}>{tr(locale, d.label)}</option>)}
          </Sel>
          <Sel value={period} onChange={(v) => setPeriod(v as Period)}>
            {PERIODS.map((p) => <option key={p.key} value={p.key}>{tr(locale, p.label)}</option>)}
          </Sel>
          <button
            onClick={doExport}
            disabled={isEmpty}
            title={tr(locale, { uz: "CSV yuklab olish", ru: "Скачать CSV", en: "Download CSV" })}
            className="flex h-10 items-center gap-1.5 rounded-lg border border-emerald-300 px-3 text-sm font-medium text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-40 dark:border-emerald-800 dark:hover:bg-emerald-950/40"
          >
            <Icon name="download" className="h-4 w-4" /> CSV
          </button>
          <button
            onClick={() => printPage()}
            title={tr(locale, { uz: "Chop etish", ru: "Печать", en: "Print" })}
            className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Icon name="copy" className="h-4 w-4" /> {tr(locale, { uz: "Chop etish", ru: "Печать", en: "Print" })}
          </button>
        </div>
      </div>

      {/* Kontent */}
      {isEmpty ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 text-slate-400 dark:border-slate-700">
          <Icon name="clock" className="h-9 w-9 opacity-40" />
          <p className="mt-3 text-sm">{tr(locale, { uz: "Tanlangan oraliqda o'tilgan dars yo'q", ru: "За выбранный период проведённых уроков нет", en: "No lessons held in the selected range" })}</p>
        </div>
      ) : listView ? (
        // Ro'yxat ko'rinishi — o'lcham bo'yicha jami soatlar
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          {rows.map((r, i) => (
            <div key={r.name} className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 last:border-0 dark:border-slate-800">
              <span className="w-6 text-slate-400">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">{r.name}</span>
              <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${grand ? (r.total / rows[0].total) * 100 : 0}%` }} />
              </div>
              <span className="w-20 text-right font-semibold text-slate-800 dark:text-slate-100">{fmtHours(r.total)} {tr(locale, { uz: "soat", ru: "ч", en: "h" })}</span>
            </div>
          ))}
        </div>
      ) : (
        // Pivot jadval — o'lcham × davr
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200/70 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="sticky left-0 z-10 bg-slate-50/60 px-4 py-3 dark:bg-slate-800/40">{dimLabel}</th>
                  {buckets.map((b) => <th key={b.key} className="px-4 py-3 text-center whitespace-nowrap">{b.label}</th>)}
                  <th className="px-4 py-3 text-center">{tr(locale, { uz: "Jami", ru: "Итого", en: "Total" })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.name} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">{r.name}</td>
                    {buckets.map((b) => (
                      <td key={b.key} className={cn("px-4 py-3 text-center", r.cells[b.key] ? "text-slate-700 dark:text-slate-200" : "text-slate-300 dark:text-slate-600")}>
                        {fmtHours(r.cells[b.key] ?? 0)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center font-bold text-brand-600 dark:text-brand-300">{fmtHours(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/60 font-bold dark:border-slate-700 dark:bg-slate-800/40">
                  <td className="sticky left-0 z-10 bg-slate-50/60 px-4 py-3 text-slate-700 dark:bg-slate-800/40 dark:text-slate-200">{tr(locale, { uz: "Jami", ru: "Итого", en: "Total" })}</td>
                  {buckets.map((b) => <td key={b.key} className="px-4 py-3 text-center text-slate-800 dark:text-slate-100">{fmtHours(colTotals[b.key] ?? 0)}</td>)}
                  <td className="px-4 py-3 text-center text-brand-600 dark:text-brand-300">{fmtHours(grand)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Sel({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="h-10 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm text-slate-700 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        {children}
      </select>
      <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}
