"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";

export default function Controls({ from, to, period, view, locale }: { from: string; to: string; period: string; view: string; locale: Locale }) {
  const router = useRouter();
  const sp = useSearchParams();
  const nav = (patch: Record<string, string>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) p.set(k, v); else p.delete(k); }
    router.push(`/reports/rooms-analytics?${p.toString()}`);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={() => nav({ view: view === "grid" ? "list" : "grid" })} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" title={view === "grid" ? tr(locale, { uz: "Ro'yxat", ru: "Список", en: "List", de: "Liste" }) : tr(locale, { uz: "Panjara", ru: "Сетка", en: "Grid", de: "Raster" })}>
        <Icon name={view === "grid" ? "listView" : "grid"} className="h-5 w-5" />
      </button>
      <div className="flex h-11 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
        <Icon name="calendar" className="h-4 w-4 shrink-0 text-slate-400" />
        <input type="date" defaultValue={from} onChange={(e) => nav({ from: e.target.value })} className="w-[118px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
        <span className="text-slate-300">–</span>
        <input type="date" defaultValue={to} onChange={(e) => nav({ to: e.target.value })} className="w-[118px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
      </div>
      <div className="relative">
        <select defaultValue={period} onChange={(e) => nav({ period: e.target.value })} className={cn("h-11 appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-sm text-slate-600 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100")}>
          <option value="day">{tr(locale, { uz: "Kun", ru: "День", en: "Day", de: "Tag" })}</option>
          <option value="week">{tr(locale, { uz: "Hafta", ru: "Неделя", en: "Week", de: "Woche" })}</option>
          <option value="month">{tr(locale, { uz: "Oy", ru: "Месяц", en: "Month", de: "Monat" })}</option>
        </select>
        <Icon name="chevronDown" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}
