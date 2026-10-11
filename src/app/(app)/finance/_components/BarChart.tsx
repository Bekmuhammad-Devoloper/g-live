"use client";

import { useState } from "react";

export interface BarDatum {
  label: string; // o'q ostidagi qisqa yozuv (masalan "Okt 26")
  value: number;
  title?: string; // tooltip sarlavhasi (masalan "Oktyabr 2026")
}

// Y o'qi uchun qisqa yozuv: 1 200 000 → "1.2M"
const compact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `${+(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${+(n / 1e3).toFixed(0)}K`;
  return String(Math.round(n));
};

// "Chiroyli" yuqori chegara: 1, 2, 2.5, 5 × 10^k
const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
};

/** Oddiy SVG ustunli diagramma (kutubxonasiz) */
export default function BarChart({
  data, color = "#f87979", formatValue = (n) => String(n), emptyText, height = 240,
}: {
  data: BarDatum[];
  color?: string;
  formatValue?: (n: number) => string;
  emptyText: string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const hasData = data.some((d) => d.value > 0);
  if (!hasData) {
    return <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>{emptyText}</div>;
  }

  const W = 600, H = height;
  const padL = 44, padR = 8, padT = 28, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const slot = plotW / data.length;
  const barW = Math.min(36, slot * 0.62);
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  // ko'p ustun bo'lsa yozuvlarni siyraklashtiramiz
  const labelEvery = Math.ceil(data.length / 12);

  const hv = hover != null ? data[hover] : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full select-none" role="img" onMouseLeave={() => setHover(null)}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="stroke-slate-200 dark:stroke-slate-700" strokeDasharray={i === 0 ? undefined : "3 3"} />
          <text x={padL - 6} y={y(t) + 3} textAnchor="end" className="fill-slate-400" fontSize="10">{compact(t)}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const cx = padL + slot * i + slot / 2;
        const top = y(d.value);
        const h = Math.max(d.value > 0 ? 2 : 0, padT + plotH - top);
        return (
          <g key={i} onMouseEnter={() => setHover(i)}>
            <rect x={padL + slot * i} y={padT} width={slot} height={plotH} fill="transparent" />
            <rect x={cx - barW / 2} y={padT + plotH - h} width={barW} height={h} rx={3} fill={color} opacity={hover == null || hover === i ? 1 : 0.55} />
            {i % labelEvery === 0 && (
              <text x={cx} y={H - 8} textAnchor="middle" className="fill-slate-400" fontSize="10">{d.label}</text>
            )}
          </g>
        );
      })}
      {hv && hover != null && (() => {
        const cx = padL + slot * hover + slot / 2;
        const text = `${hv.title ?? hv.label}: ${formatValue(hv.value)}`;
        const tw = Math.min(W - 8, text.length * 6.2 + 16);
        const tx = Math.max(4, Math.min(W - tw - 4, cx - tw / 2));
        const ty = Math.max(2, y(hv.value) - 26);
        return (
          <g pointerEvents="none">
            <rect x={tx} y={ty} width={tw} height={20} rx={5} className="fill-slate-800 dark:fill-slate-100" opacity={0.92} />
            <text x={tx + tw / 2} y={ty + 14} textAnchor="middle" fontSize="11" className="fill-white dark:fill-slate-900">{text}</text>
          </g>
        );
      })()}
    </svg>
  );
}
