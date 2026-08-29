"use client";

import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";

// Donut (halqa) diagramma — buyurtmalar taqsimoti uchun. Sof SVG.
// Kategorik ranglar qat'iy tartibda; segmentlarda native tooltip (<title>).
export const CAT = ["#4148ef", "#16a34a", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#64748b"];

export default function Donut({ items, locale }: { items: { label: string; value: number }[]; locale: Locale }) {
  const total = items.reduce((n, i) => n + i.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400 dark:border-slate-700">
        {tr(locale, { uz: "Ma'lumot mavjud emas", ru: "Данные отсутствуют", en: "No data available", de: "Keine Daten verfügbar" })}
      </div>
    );
  }

  const r = 60, cx = 80, cy = 80, thick = 26;
  const C = 2 * Math.PI * r;
  let offset = 0;
  const sorted = [...items].sort((a, b) => b.value - a.value);

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={thick} className="stroke-slate-100 dark:stroke-slate-800" />
        {sorted.map((it, i) => {
          const len = (it.value / total) * C;
          const el = (
            <circle
              key={it.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={CAT[i % CAT.length]}
              strokeWidth={thick}
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
            >
              <title>{it.label}: {it.value} ({Math.round((it.value / total) * 100)}%)</title>
            </circle>
          );
          offset += len;
          return el;
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" className="fill-slate-800 text-[20px] font-bold dark:fill-slate-100">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-slate-400 text-[9px]">{tr(locale, { uz: "jami", ru: "всего", en: "total", de: "gesamt" })}</text>
      </svg>

      <div className="min-w-0 flex-1 space-y-1.5">
        {sorted.map((it, i) => (
          <div key={it.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: CAT[i % CAT.length] }} />
            <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">{it.label}</span>
            <span className="font-semibold text-slate-800 dark:text-slate-100">{it.value}</span>
            <span className="w-10 text-right text-xs text-slate-400">{Math.round((it.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
