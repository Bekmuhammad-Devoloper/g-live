"use client";

import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import DateInput from "../../_components/DateInput";
import type { ViewCol } from "../_lib/leadColumns";

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
  branches?: Opt[];
  branch?: string;
  onBranch?: (v: string) => void;
  activeCols: Set<string>;
  onToggleCol: (key: string) => void;
  cols: ViewCol[];
  counts: Record<string, number>;
  hasFilters: boolean;
  onClear: () => void;
  sort: string;
  onSort: (v: string) => void;
  datePreset: string;
  onDatePreset: (v: string) => void;
  dateFrom: string;
  onDateFrom: (v: string) => void;
  dateTo: string;
  onDateTo: (v: string) => void;
}

export const DATE_PRESETS: { key: string; label: { uz: string; ru: string; en: string; de?: string } }[] = [
  { key: "today", label: { uz: "Bugun", ru: "Сегодня", en: "Today", de: "Heute" } },
  { key: "yesterday", label: { uz: "Kecha", ru: "Вчера", en: "Yesterday", de: "Gestern" } },
  { key: "7d", label: { uz: "Oxirgi 7 kun", ru: "Последние 7 дней", en: "Last 7 days", de: "Letzte 7 Tage" } },
  { key: "30d", label: { uz: "Oxirgi 30 kun", ru: "Последние 30 дней", en: "Last 30 days", de: "Letzte 30 Tage" } },
  { key: "month", label: { uz: "Shu oy", ru: "Этот месяц", en: "This month", de: "Dieser Monat" } },
  { key: "prevmonth", label: { uz: "O'tgan oy", ru: "Прошлый месяц", en: "Last month", de: "Letzter Monat" } },
  { key: "year", label: { uz: "Shu yil", ru: "Этот год", en: "This year", de: "Dieses Jahr" } },
  { key: "custom", label: { uz: "Oraliq (dan – gacha)", ru: "Период (с – по)", en: "Range (from – to)", de: "Zeitraum (von – bis)" } },
];

export function leadDateRange(preset: string, from: string, to: string, now = new Date()): { start: number; end: number } | null {
  const day = (y: number, m: number, d: number) => new Date(y, m, d).getTime();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  switch (preset) {
    case "today": return { start: day(y, m, d), end: day(y, m, d + 1) };
    case "yesterday": return { start: day(y, m, d - 1), end: day(y, m, d) };
    case "7d": return { start: day(y, m, d - 6), end: day(y, m, d + 1) };
    case "30d": return { start: day(y, m, d - 29), end: day(y, m, d + 1) };
    case "month": return { start: day(y, m, 1), end: day(y, m + 1, 1) };
    case "prevmonth": return { start: day(y, m - 1, 1), end: day(y, m, 1) };
    case "year": return { start: day(y, 0, 1), end: day(y + 1, 0, 1) };
    case "custom": {
      const parse = (v: string) => {
        const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
        return r ? day(+r[1], +r[2] - 1, +r[3]) : null;
      };
      let a = parse(from), b = parse(to);
      if (a === null && b === null) return null;
      if (a !== null && b !== null && a > b) [a, b] = [b, a];
      return { start: a ?? -Infinity, end: b === null ? Infinity : b + 86400000 };
    }
    default: return null;
  }
}

export const SORT_OPTIONS: { key: string; label: { uz: string; ru: string; en: string; de?: string } }[] = [
  { key: "newest", label: { uz: "Eng yangi", ru: "Сначала новые", en: "Newest", de: "Neueste" } },
  { key: "oldest", label: { uz: "Eng eski", ru: "Сначала старые", en: "Oldest", de: "Älteste" } },
  { key: "budget", label: { uz: "Byudjet (katta)", ru: "Бюджет (больше)", en: "Budget (high)", de: "Budget (hoch)" } },
  { key: "name", label: { uz: "Ism (A-Z)", ru: "Имя (А-Я)", en: "Name (A-Z)", de: "Name (A-Z)" } },
  { key: "activity", label: { uz: "Faoliyat (ko'p)", ru: "Активность (больше)", en: "Activity (most)", de: "Aktivität (meist)" } },
];

export default function FilterBar(p: Props) {
  const locale = p.locale;
  const selBase = "h-10 rounded-lg border bg-white px-3 text-sm outline-none focus:border-brand-400 dark:bg-slate-800";
  const sel = cn(selBase, "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300");
  const selOn = cn(selBase, "border-brand-400 font-medium text-brand-700 dark:border-brand-500/60 dark:text-brand-200");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={p.search}
            onChange={(e) => p.onSearch(e.target.value)}
            placeholder={tr(locale, { uz: "Ism, telefon bo'yicha qidirish...", ru: "Поиск по имени, телефону...", en: "Search by name, phone...", de: "Suche nach Name, Telefon..." })}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
        <select value={p.source} onChange={(e) => p.onSource(e.target.value)} className={sel}>
          <option value="">{tr(locale, { uz: "Manba: Barchasi", ru: "Источник: Все", en: "Source: All", de: "Quelle: Alle" })}</option>
          {p.sources.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select value={p.manager} onChange={(e) => p.onManager(e.target.value)} className={sel}>
          <option value="">{tr(locale, { uz: "Menejer: Barchasi", ru: "Менеджер: Все", en: "Manager: All", de: "Manager: Alle" })}</option>
          {p.managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        {!!p.branches?.length && p.onBranch && (
          <select value={p.branch ?? ""} onChange={(e) => p.onBranch?.(e.target.value)} className={sel}>
            <option value="">{tr(locale, { uz: "Filial: Barchasi", ru: "Филиал: Все", en: "Branch: All", de: "Filiale: Alle" })}</option>
            {p.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            <option value="none">{tr(locale, { uz: "Filialsiz", ru: "Без филиала", en: "No branch", de: "Ohne Filiale" })}</option>
          </select>
        )}
        <select value={p.datePreset} onChange={(e) => p.onDatePreset(e.target.value)} className={p.datePreset ? selOn : sel}>
          <option value="">{tr(locale, { uz: "Sana: Barchasi", ru: "Дата: Все", en: "Date: All", de: "Datum: Alle" })}</option>
          {DATE_PRESETS.map((o) => <option key={o.key} value={o.key}>{tr(locale, { uz: "Sana", ru: "Дата", en: "Date", de: "Datum" })}: {tr(locale, o.label)}</option>)}
        </select>
        {p.datePreset === "custom" && (
          <div className="flex h-10 items-center gap-2 rounded-lg border border-brand-400 bg-white px-3 dark:border-brand-500/60 dark:bg-slate-800">
            <DateInput
              locale={locale}
              value={p.dateFrom}
              onChange={(e) => p.onDateFrom(e.target.value)}
              max={p.dateTo || undefined}
              placeholder={tr(locale, { uz: "Dan", ru: "С", en: "From", de: "Von" })}
              className="w-[108px] bg-transparent text-sm text-slate-700 dark:text-slate-100"
            />
            <span className="text-slate-300 dark:text-slate-600">–</span>
            <DateInput
              locale={locale}
              value={p.dateTo}
              onChange={(e) => p.onDateTo(e.target.value)}
              min={p.dateFrom || undefined}
              placeholder={tr(locale, { uz: "Gacha", ru: "По", en: "To", de: "Bis" })}
              className="w-[108px] bg-transparent text-sm text-slate-700 dark:text-slate-100"
            />
          </div>
        )}
        <select value={p.sort} onChange={(e) => p.onSort(e.target.value)} className={sel}>
          {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{tr(locale, { uz: "Saralash", ru: "Сортировка", en: "Sort", de: "Sortieren" })}: {tr(locale, o.label)}</option>)}
        </select>
        {p.hasFilters && (
          <button onClick={p.onClear} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:text-slate-600">
            <Icon name="personX" className="h-4 w-4" /> {tr(locale, { uz: "Tozalash", ru: "Очистить", en: "Clear", de: "Zurücksetzen" })}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {p.cols.map((c) => {
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
              {c.title}
              <span className={cn("rounded px-1 text-[10px] font-bold", active ? "bg-white/25" : "bg-slate-100 dark:bg-slate-700")}>{p.counts[c.key] ?? 0}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
