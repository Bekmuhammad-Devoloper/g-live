// Yengil ustunli diagramma — tashqi kutubxonasiz, sof SVG (kodbaza uslubida).
export interface BarPoint {
  label: string;
  value: number;
}

// Y o'qi uchun "chiroyli" maksimal qiymat
function niceCeil(v: number): number {
  if (v <= 5) return 5;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

const defaultFmt = (t: number) => (Number.isInteger(t) ? String(t) : t.toFixed(1));

export default function BarChart({
  data,
  seriesLabel,
  color = "#fb7185",
  valueFormat,
}: {
  data: BarPoint[];
  seriesLabel: string;
  color?: string;
  valueFormat?: (n: number) => string;
}) {
  const fmt = valueFormat ?? defaultFmt;
  const W = 820, H = 340;
  const padL = 52, padR = 16, padT = 16, padB = 44;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const rawMax = Math.max(0, ...data.map((d) => d.value));
  const niceMax = rawMax <= 0 ? 1 : niceCeil(rawMax);
  const steps = 5;
  const yTicks = Array.from({ length: steps + 1 }, (_, i) => (niceMax / steps) * i);

  const n = Math.max(1, data.length);
  const band = plotW / n;
  const barW = Math.min(band * 0.5, 46);

  return (
    <div className="overflow-x-auto">
      {/* Legenda */}
      <div className="mb-2 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <span className="inline-block h-3 w-6 rounded-sm" style={{ background: color }} />
        {seriesLabel}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" role="img" aria-label={seriesLabel}>
        {/* Gorizontal to'r chiziqlari + Y belgilari */}
        {yTicks.map((tk, i) => {
          const y = padT + plotH - (tk / niceMax) * plotH;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="currentColor" strokeWidth={1} className="text-slate-200 dark:text-slate-700" />
              <text x={padL - 8} y={y + 3} textAnchor="end" className="fill-slate-400 text-[10px]">{fmt(tk)}</text>
            </g>
          );
        })}

        {/* Asosiy chiziq */}
        <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke="currentColor" strokeWidth={1} className="text-slate-300 dark:text-slate-600" />

        {/* Ustunlar */}
        {data.map((d, i) => {
          const x = padL + i * band + (band - barW) / 2;
          const h = niceMax > 0 ? (d.value / niceMax) * plotH : 0;
          const y = padT + plotH - h;
          return (
            <g key={i}>
              {d.value > 0 && <rect x={x} y={y} width={barW} height={h} rx={4} fill={color} />}
              {d.value > 0 && (
                <text x={x + barW / 2} y={y - 5} textAnchor="middle" className="fill-slate-500 text-[10px] font-semibold dark:fill-slate-300">{fmt(d.value)}</text>
              )}
              <text x={padL + i * band + band / 2} y={padT + plotH + 16} textAnchor="middle" className="fill-slate-400 text-[10px]">{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
