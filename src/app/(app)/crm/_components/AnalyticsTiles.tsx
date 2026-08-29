"use client";

import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { COLUMNS } from "../_lib/leadColumns";

export interface Analytics {
  total: number;
  newToday: number;
  newYesterday: number;
  byColumn: Record<string, number>;
  conversion: number;
}

export default function AnalyticsTiles({ a, locale }: { a: Analytics; locale: Locale }) {
  const delta = a.newToday - a.newYesterday;
  const ago = tr(locale, { uz: "kechaga", ru: "к вчера", en: "vs yesterday", de: "vs. gestern" });
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1">
      <Tile label={tr(locale, { uz: "Bugungi yangi", ru: "Новые сегодня", en: "New today", de: "Heute neu" })} value={a.newToday} hint={delta >= 0 ? `+${delta} ${ago}` : `${delta} ${ago}`} color="#3b82f6" icon="download" />
      {COLUMNS.map((c) => (
        <Tile key={c.key} label={tr(locale, c.label)} value={a.byColumn[c.key] ?? 0} color={c.color} icon={c.icon} />
      ))}
      <Tile label={tr(locale, { uz: "Konversiya", ru: "Конверсия", en: "Conversion", de: "Konversion" })} value={`${a.conversion}%`} color="#10b981" icon="chart" />
    </div>
  );
}

function Tile({ label, value, hint, color, icon }: { label: string; value: number | string; hint?: string; color: string; icon: string }) {
  return (
    <div className="flex min-w-[150px] shrink-0 items-center gap-3 rounded-xl border border-slate-200/70 bg-white px-3.5 py-2.5 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ color, background: `${color}1a` }}>
        <Icon name={icon} className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <div className="truncate text-[11px] font-medium text-slate-400">{label}</div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{value}</span>
          {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
        </div>
      </div>
    </div>
  );
}
