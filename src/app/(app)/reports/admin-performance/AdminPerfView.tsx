"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { exportRows } from "@/lib/export";
import { Icon } from "../../_components/Icon";

export interface AdminStudent {
  admin: string;
  status: string;
  createdAt: string; // ISO
}

type Tr = { uz: string; ru: string; en: string };

const BUCKETS = [
  { key: "aktiv", label: { uz: "Aktiv", ru: "Активные", en: "Active", de: "Aktiv" } as Tr, statuses: ["ACTIVE", "WAITING", "LEVEL_DONE"], color: "text-emerald-600 dark:text-emerald-400" },
  { key: "ketgan", label: { uz: "Ketganlar", ru: "Ушедшие", en: "Left", de: "Ausgetreten" } as Tr, statuses: ["EXPELLED", "TRANSFERRED"], color: "text-red-600 dark:text-red-400" },
  { key: "bitirgan", label: { uz: "Bitirganlar", ru: "Выпускники", en: "Graduated", de: "Absolventen" } as Tr, statuses: ["PROGRAM_DONE", "CERTIFIED"], color: "text-brand-600 dark:text-brand-300" },
  { key: "muzlatilgan", label: { uz: "Muzlatilgan", ru: "Замороженные", en: "Frozen", de: "Eingefroren" } as Tr, statuses: ["FROZEN"], color: "text-slate-500 dark:text-slate-400" },
] as const;

const GROUPS = [
  { key: "start", label: { uz: "Davr boshidagi holati", ru: "Состояние на начало периода", en: "Status at start of period", de: "Status zu Periodenbeginn" } as Tr },
  { key: "change", label: { uz: "O'zgarishlar", ru: "Изменения", en: "Changes", de: "Änderungen" } as Tr },
  { key: "end", label: { uz: "Davr oxiridagi holati", ru: "Состояние на конец периода", en: "Status at end of period", de: "Status am Periodenende" } as Tr },
] as const;

const bucketOf = (status: string) => BUCKETS.find((b) => b.statuses.includes(status as never))?.key ?? "aktiv";
const zero = () => ({ aktiv: 0, ketgan: 0, bitirgan: 0, muzlatilgan: 0 } as Record<string, number>);

export default function AdminPerfView({ rows, defaultFrom, defaultTo, locale }: { rows: AdminStudent[]; defaultFrom: string; defaultTo: string; locale: Locale }) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [sortCol, setSortCol] = useState("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortCol(col); setSortDir("desc"); }
  };

  const base = useMemo(() => {
    const byAdmin = new Map<string, AdminStudent[]>();
    for (const r of rows) {
      const arr = byAdmin.get(r.admin) ?? [];
      arr.push(r);
      byAdmin.set(r.admin, arr);
    }

    const compute = (list: AdminStudent[]) => {
      const start = zero(), change = zero(), end = zero();
      for (const st of list) {
        const day = st.createdAt.slice(0, 10);
        const b = bucketOf(st.status);
        if (!from || day < from) start[b]++;            // davr boshidan oldin mavjud
        if ((!from || day >= from) && (!to || day <= to)) change[b]++; // davr ichida qo'shilgan
        if (!to || day <= to) end[b]++;                 // davr oxiriga qadar jami
      }
      return { start, change, end };
    };

    return [...byAdmin.entries()]
      .map(([name, list]) => ({ name, total: list.length, ...compute(list) }));
  }, [rows, from, to]);

  const admins = useMemo(() => {
    const val = (a: (typeof base)[number]): string | number => {
      if (sortCol === "name") return a.name;
      if (sortCol === "total") return a.total;
      const [g, b] = sortCol.split("_") as ["start" | "change" | "end", string];
      return a[g]?.[b] ?? 0;
    };
    const arr = [...base].sort((x, y) => {
      const vx = val(x), vy = val(y);
      const cmp = typeof vx === "string" || typeof vy === "string"
        ? String(vx).localeCompare(String(vy))
        : (vx as number) - (vy as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [base, sortCol, sortDir]);

  const totals = useMemo(() => {
    const t = { start: zero(), change: zero(), end: zero() };
    for (const a of admins) for (const g of ["start", "change", "end"] as const)
      for (const b of BUCKETS) t[g][b.key] += a[g][b.key];
    return t;
  }, [admins]);

  const groupBorder = "border-l border-slate-200/70 dark:border-slate-800";

  const onExport = () => {
    const cols = [
      { key: "name", label: tr(locale, { uz: "Ism", ru: "Имя", en: "Name", de: "Name" }) },
      ...GROUPS.flatMap((g) => BUCKETS.map((b) => ({ key: `${g.key}_${b.key}`, label: `${tr(locale, g.label)}: ${tr(locale, b.label)}` }))),
    ];
    const data = admins.map((a) => {
      const rec: Record<string, string | number> = { name: a.name };
      for (const g of GROUPS) for (const b of BUCKETS) rec[`${g.key}_${b.key}`] = a[g.key][b.key];
      return rec;
    });
    exportRows("administratorlar-samaradorligi", cols, data);
  };

  const SortTh = ({ col, label, className }: { col: string; label: string; className?: string }) => (
    <button type="button" onClick={() => toggleSort(col)} className={cn("inline-flex items-center gap-1 hover:text-brand-600 dark:hover:text-brand-300", className)} title={tr(locale, { uz: "Saralash", ru: "Сортировка", en: "Sort", de: "Sortieren" })}>
      <span>{label}</span>
      <Icon name="arrow" className={cn("h-3 w-3", sortCol === col ? "text-brand-500" : "text-slate-300 dark:text-slate-600", sortCol === col && sortDir === "asc" && "rotate-180")} />
    </button>
  );

  return (
    <div className="space-y-3">
      {/* Sana oralig'i */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
          <Icon name="calendar" className="h-4 w-4 text-slate-400" />
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[118px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
          <span className="text-slate-300">–</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[118px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
        </div>
        <button type="button" onClick={onExport} className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
          <Icon name="download" className="h-4 w-4" />
          CSV
        </button>
      </div>

      {/* Jadval */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="text-slate-500 dark:text-slate-400">
              <tr className="border-b border-slate-200/70 text-[12px] font-bold uppercase tracking-wider dark:border-slate-800">
                <th rowSpan={2} className="px-4 py-3">№</th>
                <th rowSpan={2} className="px-4 py-3"><SortTh col="name" label={tr(locale, { uz: "Ism", ru: "Имя", en: "Name", de: "Name" })} /></th>
                {GROUPS.map((g) => (
                  <th key={g.key} colSpan={4} className={cn("px-4 py-3 text-center", groupBorder)}>{tr(locale, g.label)}</th>
                ))}
              </tr>
              <tr className="border-b border-slate-200/70 text-[11px] font-semibold uppercase tracking-wider dark:border-slate-800">
                {GROUPS.map((g) =>
                  BUCKETS.map((b, bi) => (
                    <th key={g.key + b.key} className={cn("px-4 py-2.5 text-center", bi === 0 && groupBorder)}>
                      <SortTh col={`${g.key}_${b.key}`} label={tr(locale, b.label)} />
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {admins.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-16 text-center">
                    <Icon name="user" className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                    <div className="mt-2 text-sm text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi", ru: "Данные не найдены", en: "No data found", de: "Keine Daten gefunden" })}</div>
                  </td>
                </tr>
              ) : (
                admins.map((a, i) => (
                  <tr key={a.name} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{a.name}</td>
                    {GROUPS.map((g) =>
                      BUCKETS.map((b, bi) => (
                        <td key={g.key + b.key} className={cn("px-4 py-3 text-center font-semibold", bi === 0 && groupBorder, a[g.key][b.key] > 0 ? b.color : "text-slate-300 dark:text-slate-600")}>
                          {a[g.key][b.key]}
                        </td>
                      ))
                    )}
                  </tr>
                ))
              )}
            </tbody>
            {admins.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/60 text-sm font-bold dark:border-slate-700 dark:bg-slate-800/40">
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{tr(locale, { uz: "Jami", ru: "Итого", en: "Total", de: "Gesamt" })}</td>
                  {GROUPS.map((g) =>
                    BUCKETS.map((b, bi) => (
                      <td key={g.key + b.key} className={cn("px-4 py-3 text-center text-slate-800 dark:text-slate-100", bi === 0 && groupBorder)}>
                        {totals[g.key][b.key]}
                      </td>
                    ))
                  )}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
