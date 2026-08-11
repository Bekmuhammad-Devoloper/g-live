"use client";

import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { COLUMNS } from "../_lib/leadColumns";

interface Opt { id: string; name: string }

interface Props {
  locale: Locale;
  search: string;
  onSearch: (v: string) => void;
  sources: string[];
  source: string;
  onSource: (v: string) => void;
  managers: Opt[];
  manager: string;
  onManager: (v: string) => void;
  activeCols: Set<string>;
  onToggleCol: (key: string) => void;
  counts: Record<string, number>;
  hasFilters: boolean;
  onClear: () => void;
  sort: string;
  onSort: (v: string) => void;
}

export const SORT_OPTIONS: { key: string; label: { uz: string; ru: string; en: string } }[] = [
  { key: "newest", label: { uz: "Eng yangi", ru: "Сначала новые", en: "Newest" } },
  { key: "oldest", label: { uz: "Eng eski", ru: "Сначала старые", en: "Oldest" } },
  { key: "budget", label: { uz: "Byudjet (katta)", ru: "Бюджет (больше)", en: "Budget (high)" } },
  { key: "name", label: { uz: "Ism (A-Z)", ru: "Имя (А-Я)", en: "Name (A-Z)" } },
  { key: "activity", label: { uz: "Faoliyat (ko'p)", ru: "Активность (больше)", en: "Activity (most)" } },
];

export default function FilterBar(p: Props) {
  const locale = p.locale;
  const sel = "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={p.search}
            onChange={(e) => p.onSearch(e.target.value)}
            placeholder={tr(locale, { uz: "Ism, telefon bo'yicha qidirish...", ru: "Поиск по имени, телефону...", en: "Search by name, phone..." })}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
        <select value={p.source} onChange={(e) => p.onSource(e.target.value)} className={sel}>
          <option value="">{tr(locale, { uz: "Manba: Barchasi", ru: "Источник: Все", en: "Source: All" })}</option>
          {p.sources.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select value={p.manager} onChange={(e) => p.onManager(e.target.value)} className={sel}>
          <option value="">{tr(locale, { uz: "Menejer: Barchasi", ru: "Менеджер: Все", en: "Manager: All" })}</option>
          {p.managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={p.sort} onChange={(e) => p.onSort(e.target.value)} className={sel}>
          {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{tr(locale, { uz: "Saralash", ru: "Сортировка", en: "Sort" })}: {tr(locale, o.label)}</option>)}
        </select>
        {p.hasFilters && (
          <button onClick={p.onClear} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:text-slate-600">
            <Icon name="personX" className="h-4 w-4" /> {tr(locale, { uz: "Tozalash", ru: "Очистить", en: "Clear" })}
          </button>
        )}
      </div>

      {/* Bosqich chiplari */}
      <div className="flex flex-wrap gap-2">
        {COLUMNS.map((c) => {
          const active = p.activeCols.has(c.key);
          return (
            <button
              key={c.key}
              onClick={() => p.onToggleCol(c.key)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                active ? "text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              )}
              style={active ? { background: c.color, borderColor: c.color } : undefined}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: active ? "#fff" : c.color }} />
              {tr(locale, c.label)}
              <span className={cn("rounded px-1 text-[10px] font-bold", active ? "bg-white/25" : "bg-slate-100 dark:bg-slate-700")}>{p.counts[c.key] ?? 0}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
