"use client";

import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { firstName, type VKpiRow } from "./KpiShared";

// Eski loyihadagi recharts BarChart o'rniga — inline SVG (recharts o'rnatilmagan).
// Ikki qator: KPI % (ko'k) va Konversiya % (yashil), 0..100 shkala.
const KPI_FILL = "#3b82f6";
const CONV_FILL = "#10b981";

/** Faqat yuqori burchaklari yumaloq ustun (recharts radius=[6,6,0,0] kabi). */
function bar(x: number, y: number, w: number, h: number, r = 4): string {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

export default function KpiChart({ rows, locale }: { rows: VKpiRow[]; locale: Locale }) {
  const t = {
    kpi: "KPI %",
    conv: `${tr(locale, { uz: "Konversiya", ru: "Конверсия", en: "Conversion" })} %`,
    empty: tr(locale, { uz: "Ma'lumot yo'q", ru: "Нет данных", en: "No data" }),
  };

  if (rows.length === 0) {
    return <div className="grid h-[260px] place-items-center text-sm text-slate-400">{t.empty}</div>;
  }

  const W = 760;
  const H = 300;
  const padL = 34;
  const padR = 12;
  const padT = 12;
  const padB = 42;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const colW = plotW / rows.length;
  // Ikki ustun orasida 2px bo'shliq, guruhlar orasida esa kengroq oraliq qoladi.
  const bw = Math.max(6, Math.min(22, colW * 0.28));
  const gap = 3;
  const y = (v: number) => padT + plotH - (Math.max(0, Math.min(100, v)) / 100) * plotH;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[260px] w-full" role="img" aria-label={`${t.kpi} / ${t.conv}`}>
        {/* To'r chiziqlari */}
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line
              x1={padL}
              y1={y(g)}
              x2={W - padR}
              y2={y(g)}
              stroke="currentColor"
              strokeDasharray={g === 0 ? "0" : "3 4"}
              className="text-slate-200 dark:text-slate-700"
            />
            <text x={padL - 6} y={y(g) + 3} textAnchor="end" fontSize="10" className="fill-slate-400">
              {g}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cx = padL + colW * (i + 0.5);
          const hk = (Math.max(0, Math.min(100, r.kpiPct)) / 100) * plotH;
          const hc = (Math.max(0, Math.min(100, r.conv)) / 100) * plotH;
          return (
            <g key={r.id}>
              <title>{`${r.name} — ${t.kpi}: ${r.kpiPct} · ${t.conv}: ${r.conv}`}</title>
              {hk > 0 && <path d={bar(cx - bw - gap / 2, y(r.kpiPct), bw, hk)} fill={KPI_FILL} />}
              {hc > 0 && <path d={bar(cx + gap / 2, y(r.conv), bw, hc)} fill={CONV_FILL} />}
              <text x={cx} y={padT + plotH + 16} textAnchor="middle" fontSize="11" className="fill-slate-500 dark:fill-slate-400">
                {firstName(r.name)}
              </text>
              <text x={cx} y={padT + plotH + 30} textAnchor="middle" fontSize="10" className="fill-slate-400">
                {r.kpiPct}% / {r.conv}%
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex items-center justify-center gap-5 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: KPI_FILL }} /> {t.kpi}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CONV_FILL }} /> {t.conv}
        </span>
      </div>
    </div>
  );
}
