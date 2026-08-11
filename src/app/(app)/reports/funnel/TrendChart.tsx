"use client";

import { useState } from "react";

export interface Series {
  name: string;
  color: string;
  values: number[];
}

// Ko'p qatorli chiziqli grafik (Lidlar tahlili). Sof SVG — tashqi kutubxonasiz.
// Ranglar qat'iy tartibda; identifikatsiya legenda + yorliq orqali (rang-yolg'iz emas).
export default function TrendChart({ labels, series, yLabel }: { labels: string[]; series: Series[]; yLabel?: string }) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 620, H = 240, PL = 40, PR = 12, PT = 12, PB = 28;
  const plotW = W - PL - PR, plotH = H - PT - PB;
  const n = labels.length;
  const maxVal = Math.max(1, ...series.flatMap((s) => s.values));
  const steps = 5;

  const x = (i: number) => PL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PT + plotH - (v / maxVal) * plotH;

  const xLabelEvery = Math.max(1, Math.ceil(n / 7));

  return (
    <div>
      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto" }} onMouseLeave={() => setHover(null)}>
          {/* Y grid + yorliqlar */}
          {Array.from({ length: steps + 1 }, (_, i) => {
            const v = (maxVal / steps) * (steps - i);
            const yy = PT + (plotH / steps) * i;
            return (
              <g key={i}>
                <line x1={PL} y1={yy} x2={W - PR} y2={yy} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" />
                <text x={PL - 6} y={yy + 3} textAnchor="end" className="fill-slate-400 text-[9px]">{Math.round(v)}</text>
              </g>
            );
          })}

          {/* X yorliqlar */}
          {labels.map((lb, i) =>
            i % xLabelEvery === 0 ? (
              <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-slate-400 text-[9px]">{lb}</text>
            ) : null
          )}

          {/* Qatorlar (area + line) */}
          {series.map((s) => {
            const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
            const area = `${PL},${PT + plotH} ${pts} ${x(n - 1)},${PT + plotH}`;
            return (
              <g key={s.name}>
                <polyline points={area} fill={s.color} opacity="0.08" stroke="none" />
                <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              </g>
            );
          })}

          {/* Hover crosshair */}
          {hover !== null && (
            <line x1={x(hover)} y1={PT} x2={x(hover)} y2={PT + plotH} className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="1" strokeDasharray="3 3" />
          )}
          {hover !== null && series.map((s) => (
            <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r="3.2" fill={s.color} className="stroke-white dark:stroke-slate-900" strokeWidth="1.5" />
          ))}

          {/* Hover hit-zones */}
          {labels.map((_, i) => (
            <rect key={i} x={x(i) - plotW / (2 * Math.max(1, n))} y={PT} width={plotW / Math.max(1, n)} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        </svg>

        {/* Tooltip */}
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-pop dark:border-slate-700 dark:bg-slate-800"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: "translateX(-50%)" }}
          >
            <div className="mb-1 font-semibold text-slate-700 dark:text-slate-200">{labels[hover]}</div>
            {series.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5 whitespace-nowrap text-slate-500 dark:text-slate-400">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} /> {s.name}: <span className="font-medium text-slate-700 dark:text-slate-200">{s.values[hover]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {yLabel && <div className="mt-1 text-center text-[10px] text-slate-400">{yLabel}</div>}

      {/* Legenda */}
      <div className="mt-3 flex flex-wrap justify-center gap-4">
        {series.map((s) => (
          <div key={s.name} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <span className="h-3 w-5 rounded border-2" style={{ borderColor: s.color }} /> {s.name}
          </div>
        ))}
      </div>
    </div>
  );
}
