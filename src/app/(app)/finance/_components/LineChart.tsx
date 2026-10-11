"use client";

import { useState } from "react";

// Oylik summalar uchun bitta qatorli chiziqli grafik. Sof SVG — tashqi kutubxonasiz.
export default function LineChart({
  labels,
  values,
  color = "#f18024",
  formatValue = (v) => String(v),
  emptyText,
  height = 220,
}: {
  labels: string[];
  values: number[];
  color?: string;
  formatValue?: (v: number) => string;
  emptyText: string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (values.length === 0 || values.every((v) => !v)) {
    return <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>{emptyText}</div>;
  }

  const W = 620, H = height, PL = 52, PR = 14, PT = 14, PB = 28;
  const plotW = W - PL - PR, plotH = H - PT - PB;
  const n = labels.length;
  const maxVal = niceMax(Math.max(1, ...values));
  const steps = 4;

  const x = (i: number) => PL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PT + plotH - (v / maxVal) * plotH;
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `${x(0)},${PT + plotH} ${pts} ${x(n - 1)},${PT + plotH}`;
  const xLabelEvery = Math.max(1, Math.ceil(n / 12));

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto" }} onMouseLeave={() => setHover(null)}>
        {Array.from({ length: steps + 1 }, (_, i) => {
          const v = (maxVal / steps) * (steps - i);
          const yy = PT + (plotH / steps) * i;
          return (
            <g key={i}>
              <line x1={PL} y1={yy} x2={W - PR} y2={yy} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" />
              <text x={PL - 6} y={yy + 3} textAnchor="end" className="fill-slate-400 text-[10px]">{compact(v)}</text>
            </g>
          );
        })}
        {labels.map((lb, i) =>
          i % xLabelEvery === 0 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-slate-400 text-[10px]">{lb}</text>
          ) : null,
        )}
        <polyline points={area} fill={color} opacity="0.1" stroke="none" />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {values.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 4.5 : 3} fill={color} className="stroke-white dark:stroke-slate-900" strokeWidth="1.5" />
        ))}
        {hover !== null && (
          <line x1={x(hover)} y1={PT} x2={x(hover)} y2={PT + plotH} className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="1" strokeDasharray="3 3" />
        )}
        {labels.map((_, i) => (
          <rect key={i} x={x(i) - plotW / (2 * Math.max(1, n - 1 || 1))} y={PT} width={plotW / Math.max(1, n - 1 || 1)} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-1 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-pop dark:border-slate-700 dark:bg-slate-800"
          style={{ left: `${Math.min(85, Math.max(15, (x(hover) / W) * 100))}%`, transform: "translateX(-50%)" }}
        >
          <div className="font-semibold text-slate-700 dark:text-slate-200">{labels[hover]}</div>
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} /> {formatValue(values[hover])}
          </div>
        </div>
      )}
    </div>
  );
}

function niceMax(v: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
  return nice * p;
}

function compact(v: number): string {
  if (v >= 1e9) return `${+(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${+(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${+(v / 1e3).toFixed(0)}K`;
  return String(Math.round(v));
}

const MONTHS: Record<string, string[]> = {
  uz: ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"],
  ru: ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  de: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
};

/**
 * Oxirgi `count` oy bo'yicha summalar: [{key:"YYYY-MM", label:"MMM YY"}] va qiymatlar.
 * `items` — mahalliy sana (YYYY-MM-DD...) va summa.
 */
export function monthlySeries(items: { day: string; amount: number }[], locale: string, count = 12) {
  const now = new Date();
  const keys: string[] = [];
  const labels: string[] = [];
  const names = MONTHS[locale] ?? MONTHS.uz;
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    labels.push(`${names[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`);
  }
  const idx = new Map(keys.map((k, i) => [k, i]));
  const values = keys.map(() => 0);
  for (const it of items) {
    const i = idx.get(it.day.slice(0, 7));
    if (i !== undefined) values[i] += it.amount;
  }
  return { labels, values };
}
