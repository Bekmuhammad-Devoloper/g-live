"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../_components/Icon";
import { exportRows } from "@/lib/export";

export interface VRatingStudent {
  id: string;
  name: string;
  group: string | null;
  marks: { date: string; pct: number }[]; // date ISO, pct 0..100
}

type SortKey = "name" | "group" | "baho";

const scoreColor = (v: number) => (v >= 80 ? "#10b981" : v >= 60 ? "#f59e0b" : "#ef4444");

export default function RatingView({ students, defaultFrom, defaultTo, locale }: { students: VRatingStudent[]; defaultFrom: string; defaultTo: string; locale: Locale }) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [tab, setTab] = useState<"chart" | "table">("table");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "baho", dir: "desc" });
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const f = from ? new Date(from + "T00:00:00").getTime() : -Infinity;
    const t = to ? new Date(to + "T23:59:59").getTime() : Infinity;
    const list = students.map((st) => {
      const inRange = st.marks.filter((m) => { const d = new Date(m.date).getTime(); return d >= f && d <= t; });
      const baho = inRange.length ? Math.round(inRange.reduce((n, m) => n + m.pct, 0) / inRange.length) : null;
      return { id: st.id, name: st.name, group: st.group, baho, count: inRange.length };
    }).filter((r) => r.baho !== null) as { id: string; name: string; group: string | null; baho: number; count: number }[];

    const dir = sort.dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sort.key === "baho") return (a.baho - b.baho) * dir;
      if (sort.key === "group") return (a.group ?? "").localeCompare(b.group ?? "") * dir;
      return a.name.localeCompare(b.name) * dir;
    });
    return list;
  }, [students, from, to, sort]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const cur = Math.min(page, totalPages);
  const shown = rows.slice((cur - 1) * pageSize, cur * pageSize);
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "baho" ? "desc" : "asc" }));

  const exportCsv = () =>
    exportRows(
      `reyting_${from}_${to}`,
      [
        { key: "rank", label: tr(locale, { uz: "O'rin", ru: "Место", en: "Rank" }) },
        { key: "name", label: tr(locale, { uz: "Ism", ru: "Имя", en: "Name" }) },
        { key: "group", label: tr(locale, { uz: "Guruh", ru: "Группа", en: "Group" }) },
        { key: "baho", label: tr(locale, { uz: "Baho", ru: "Оценка", en: "Score" }) },
        { key: "count", label: tr(locale, { uz: "Baholar soni", ru: "Количество оценок", en: "Number of scores" }) },
      ],
      rows.map((r, i) => ({ rank: i + 1, name: r.name, group: r.group ?? "", baho: r.baho, count: r.count }))
    );

  const dateInput = "h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

  return (
    <div className="space-y-4">
      <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Reyting", ru: "Рейтинг", en: "Rating" })}</h1>

      {/* Sana oralig'i */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="relative">
          <Icon name="calendar" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={dateInput} />
        </div>
        <div className="relative">
          <Icon name="calendar" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={dateInput} />
        </div>
      </div>

      {/* Tablar */}
      <div className="flex items-center gap-5 border-b border-slate-200 dark:border-slate-800">
        <TabBtn active={tab === "chart"} onClick={() => setTab("chart")}>{tr(locale, { uz: "Grafik", ru: "График", en: "Chart" })}</TabBtn>
        <TabBtn active={tab === "table"} onClick={() => setTab("table")}>{tr(locale, { uz: "Jadval", ru: "Таблица", en: "Table" })}</TabBtn>
        <button
          onClick={exportCsv}
          disabled={rows.length === 0}
          title={tr(locale, { uz: "CSV yuklab olish", ru: "Скачать CSV", en: "Download CSV" })}
          className="mb-2 ml-auto inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-40 dark:border-emerald-800 dark:hover:bg-emerald-950/40"
        >
          <Icon name="download" className="h-4 w-4" /> {tr(locale, { uz: "Eksport", ru: "Экспорт", en: "Export" })}
        </button>
      </div>

      {tab === "table" ? (
        <div className="rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-slate-200/70 text-[13px] font-semibold text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="w-16 px-4 py-4 text-center">№</th>
                  <SortableTh label={tr(locale, { uz: "Ism", ru: "Имя", en: "Name" })} active={sort.key === "name"} dir={sort.dir} onClick={() => toggleSort("name")} />
                  <SortableTh label={tr(locale, { uz: "Guruh", ru: "Группа", en: "Group" })} active={sort.key === "group"} dir={sort.dir} onClick={() => toggleSort("group")} />
                  <SortableTh label={tr(locale, { uz: "Baho", ru: "Оценка", en: "Score" })} align="right" active={sort.key === "baho"} dir={sort.dir} onClick={() => toggleSort("baho")} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {shown.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-400">{tr(locale, { uz: "Bo'sh", ru: "Пусто", en: "Empty" })}</td></tr>
                ) : shown.map((r, i) => {
                  const rank = (cur - 1) * pageSize + i + 1;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 text-center font-bold text-slate-500">{rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}</td>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{r.name}</td>
                      <td className="px-4 py-3 text-slate-500">{r.group ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div className="h-full rounded-full" style={{ width: `${r.baho}%`, background: scoreColor(r.baho) }} />
                          </div>
                          <span className="w-9 text-right font-bold tabular-nums" style={{ color: scoreColor(r.baho) }}>{r.baho}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Sahifalash */}
          <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {[20, 50, 100].map((n) => <option key={n} value={n}>{n}/{tr(locale, { uz: "sahifa", ru: "страница", en: "page" })}</option>)}
            </select>
            <div className="flex items-center gap-1.5">
              <PageBtn disabled={cur <= 1} onClick={() => setPage(cur - 1)}>‹</PageBtn>
              <span className="grid h-8 min-w-8 place-items-center rounded-lg bg-brand-600 px-2 text-sm font-semibold text-white">{cur}</span>
              <PageBtn disabled={cur >= totalPages} onClick={() => setPage(cur + 1)}>›</PageBtn>
            </div>
            <span className="ml-auto text-xs text-slate-400">{tr(locale, { uz: "Jami", ru: "Всего", en: "Total" })}: {rows.length}</span>
          </div>
        </div>
      ) : (
        <RatingChart rows={rows} locale={locale} />
      )}
    </div>
  );
}

function RatingChart({ rows, locale }: { rows: { id: string; name: string; baho: number }[]; locale: Locale }) {
  const top = rows.slice(0, 20);
  if (top.length === 0) {
    return <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center text-slate-400 dark:border-slate-700">{tr(locale, { uz: "Bo'sh", ru: "Пусто", en: "Empty" })}</div>;
  }
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="space-y-2.5">
        {top.map((r, i) => (
          <div key={r.id} className="flex items-center gap-3">
            <span className="w-6 shrink-0 text-right text-xs font-bold text-slate-400">{i + 1}</span>
            <span className="w-40 shrink-0 truncate text-sm font-medium text-slate-700 dark:text-slate-200">{r.name}</span>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="flex h-full items-center justify-end rounded-full pr-2 text-[10px] font-bold text-white transition-all" style={{ width: `${Math.max(6, r.baho)}%`, background: scoreColor(r.baho) }}>{r.baho}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SortableTh({ label, active, dir, onClick, align }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void; align?: "right" }) {
  return (
    <th className={cn("px-4 py-4", align === "right" && "text-right")}>
      <button onClick={onClick} className={cn("inline-flex items-center gap-1 transition", align === "right" && "flex-row-reverse", active ? "text-brand-600 dark:text-brand-300" : "hover:text-slate-700 dark:hover:text-slate-200")}>
        {label}
        <span className={cn("text-[10px]", active ? "opacity-100" : "opacity-30")}>{active && dir === "desc" ? "▼" : "▲"}</span>
      </button>
    </th>
  );
}
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("-mb-px border-b-2 px-1 pb-2.5 text-sm font-medium transition", active ? "border-brand-600 text-brand-600 dark:text-brand-300" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>
      {children}
    </button>
  );
}
function PageBtn({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return <button onClick={onClick} disabled={disabled} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800">{children}</button>;
}
