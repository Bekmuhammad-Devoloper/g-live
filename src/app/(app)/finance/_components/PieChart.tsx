"use client";

import { useState } from "react";

export interface PieDatum {
  label: string;
  value: number;
}

export const PIE_COLORS = ["#f87979", "#f18024", "#3b82f6", "#10b981", "#8b5cf6", "#eab308", "#ec4899", "#14b8a6", "#64748b", "#ef4444", "#6366f1", "#84cc16"];

/** Oddiy SVG doiraviy diagramma + izoh ro'yxati (kutubxonasiz) */
export default function PieChart({
  data, formatValue = (n) => String(n), emptyText, size = 200,
}: {
  data: PieDatum[];
  formatValue?: (n: number) => string;
  emptyText: string;
  size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const items = data.filter((d) => d.value > 0);
  const total = items.reduce((n, d) => n + d.value, 0);
  if (total <= 0) {
    return <div className="flex items-center justify-center text-sm text-slate-400" style={{ height: size }}>{emptyText}</div>;
  }

  const R = 100, C = 110;
  let acc = 0;
  const slices = items.map((d, i) => {
    const a0 = (acc / total) * Math.PI * 2;
    acc += d.value;
    const a1 = (acc / total) * Math.PI * 2;
    const p = (a: number, r = R) => [C + r * Math.sin(a), C - r * Math.cos(a)];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    // yagona bo'lak — to'liq doira
    const path = items.length === 1
      ? `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} Z`
      : `M ${C} ${C} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
    const mid = (a0 + a1) / 2;
    const [ox, oy] = [Math.sin(mid) * 6, -Math.cos(mid) * 6];
    return { d, i, path, ox, oy, color: PIE_COLORS[i % PIE_COLORS.length], pct: (d.value / total) * 100 };
  });

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
      <svg viewBox="0 0 220 220" style={{ width: size, height: size }} className="shrink-0" role="img" onMouseLeave={() => setHover(null)}>
        {slices.map((s) => (
          <path key={s.i} d={s.path} fill={s.color} stroke="white" strokeWidth={1.5} className="cursor-pointer transition-transform dark:stroke-slate-900"
            transform={hover === s.i ? `translate(${s.ox} ${s.oy})` : undefined}
            opacity={hover == null || hover === s.i ? 1 : 0.6}
            onMouseEnter={() => setHover(s.i)}>
            <title>{`${s.d.label}: ${formatValue(s.d.value)} (${s.pct.toFixed(1)}%)`}</title>
          </path>
        ))}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1 text-xs">
        {slices.map((s) => (
          <li key={s.i} onMouseEnter={() => setHover(s.i)} onMouseLeave={() => setHover(null)}
            className={`flex items-center gap-2 rounded px-1.5 py-0.5 ${hover === s.i ? "bg-slate-100 dark:bg-slate-800" : ""}`}>
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300" title={s.d.label}>{s.d.label}</span>
            <span className="shrink-0 whitespace-nowrap font-medium text-slate-700 dark:text-slate-200">{formatValue(s.d.value)}</span>
            <span className="w-10 shrink-0 text-right text-slate-400">{s.pct.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
