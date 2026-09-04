// Miyaning "suv kabi to'lishi"ni chizib ko'rish.
//   node scripts/brain-preview.mjs   →   /tmp/brain-preview.png
// Ishlab chiqarish kodi emas: dizaynni ko'z bilan tekshirish uchun.

import sharp from "sharp";

const TEAL = "#0e7490";

const OUTER =
  "M62 8C48 3 33 7 26 18 14 21 8 34 13 45 4 53 5 68 15 74c1 11 12 18 23 15 6 7 17 9 25 3 9 6 21 3 26-5 12 1 22-9 21-21 8-8 7-22-3-28 2-13-8-24-21-24-5-5-15-9-24-6Z";
const FOLDS = [
  "M61 9c-2 20 2 38-1 78",
  "M42 22c-8 6-5 15 3 19-9 4-10 15-2 20",
  "M80 22c8 6 5 15-3 19 9 4 10 15 2 20",
  "M32 36c6 3 7 10 3 14",
  "M90 36c-6 3-7 10-3 14",
];

// O'lchangan chegara: y 4.5 .. 96.8
const TOP = 4.5, BOTTOM = 96.8, SPAN = BOTTOM - TOP;

/** Suv yuzasi — yengil to'lqin, keyin pastga to'ldiriladi */
function waterPath(pct) {
  const y = BOTTOM - (SPAN * pct) / 100;
  const a = 3.2; // to'lqin balandligi
  return `M0 ${y} C20 ${y - a}, 40 ${y + a}, 60 ${y} C80 ${y - a}, 100 ${y + a}, 120 ${y} L120 110 L0 110 Z`;
}

function brain(pct, px, id) {
  const empty = pct <= 0;
  return `
  <svg width="${px}" height="${Math.round((px * 93) / 112)}" viewBox="5 4 112 93" overflow="visible">
    <defs>
      <clipPath id="c${id}"><path d="${OUTER}"/></clipPath>
      <clipPath id="w${id}"><path d="${waterPath(pct)}"/></clipPath>
      <linearGradient id="g${id}" x1="0" y1="0" x2="0.55" y2="1">
        <stop offset="0%" stop-color="#3fc9e4"/><stop offset="100%" stop-color="${TEAL}"/>
      </linearGradient>
    </defs>

    <path d="${OUTER}" fill="rgba(255,255,255,0.72)"/>
    ${FOLDS.map((d) => `<path d="${d}" fill="none" stroke="#b6cdd8" stroke-width="2.2" stroke-linecap="round"/>`).join("")}

    ${empty ? "" : `<g clip-path="url(#c${id})">
      <path d="${waterPath(pct)}" fill="url(#g${id})"/>
      <g clip-path="url(#w${id})">
        ${FOLDS.map((d) => `<path d="${d}" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2.2" stroke-linecap="round"/>`).join("")}
      </g>
    </g>`}

    <path d="${OUTER}" fill="none" stroke="#9db9c6" stroke-width="2.4" stroke-linejoin="round"/>
    ${empty ? "" : `<g clip-path="url(#w${id})"><path d="${OUTER}" fill="none" stroke="rgba(255,255,255,0.92)" stroke-width="2.4" stroke-linejoin="round"/></g>`}
  </svg>`;
}


// ── Butun sahifa maketi (360px) ──
const W = 360, PAD = 16, CW = W - PAD * 2;
const BR = 88, BRH = Math.round((BR * 93) / 112);
const LESSONS = [
  { title: "kirish", pct: 100 },
  { title: "test", pct: 50 },
  { title: "Die Familie", pct: 0 },
];
const NODE_H = BRH + 6 + 15 + 4 + 26 + 4 + 14;
const AXON_H = 56;

let y = 78;
const parts = [];
LESSONS.forEach((l, i) => {
  const right = i % 2 === 1;
  const cx = PAD + CW * (right ? 0.77 : 0.23);
  const lit = l.pct > 0 || i === LESSONS.findIndex((x) => x.pct < 100);
  if (i > 0) {
    const fx = PAD + CW * (right ? 0.23 : 0.77), tx = PAD + CW * (right ? 0.77 : 0.23);
    parts.push(`<path d="M${fx} ${y} C${fx} ${y+30}, ${tx} ${y+26}, ${tx} ${y+AXON_H}" fill="none" stroke="${lit ? TEAL : "#a9c4d1"}" stroke-opacity="${lit?0.8:0.6}" stroke-width="${lit?4:3}" stroke-linecap="round" ${lit?"":'stroke-dasharray="7 10"'}/>`);
    if (lit) parts.push(`<circle cx="${(fx+tx)/2}" cy="${y+28}" r="5" fill="${TEAL}" opacity="0.85"/>`);
    y += AXON_H;
  }
  if (i === LESSONS.findIndex((x) => x.pct < 100)) {
    parts.push(`<circle cx="${cx}" cy="${y + BRH/2}" r="52" fill="none" stroke="${TEAL}" stroke-opacity="0.28" stroke-width="2.5"/>`);
  }
  parts.push(`<g transform="translate(${cx - BR/2}, ${y})">${brain(l.pct, BR, "n"+i)}</g>`);
  const ty = y + BRH + 6;
  const ch = Math.floor(i/3)+1, ic = (i%3)+1;
  parts.push(`<text x="${cx}" y="${ty+12}" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="800" fill="#0f172a">Unit ${ch}.${ic}</text>`);
  parts.push(`<text x="${cx}" y="${ty+28}" text-anchor="middle" font-family="sans-serif" font-size="11.5" fill="#475569">${l.title}</text>`);
  const bg = l.pct >= 100 ? "rgba(14,116,144,0.16)" : l.pct > 0 ? "rgba(63,201,228,0.20)" : "rgba(148,163,184,0.16)";
  const fg = l.pct > 0 ? "#134e5e" : "#475569";
  parts.push(`<rect x="${cx-22}" y="${ty+35}" width="44" height="18" rx="9" fill="${bg}"/><text x="${cx}" y="${ty+48}" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="800" fill="${fg}">${l.pct}%</text>`);
  y += NODE_H;
});
const H = y + 60;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="100%" height="100%" fill="#eef3f6"/>
  <circle cx="${PAD+22}" cy="34" r="22" fill="rgba(255,255,255,0.55)"/>
  <path d="M${PAD+28} 26l-8 8 8 8" fill="none" stroke="${TEAL}" stroke-width="2.4" stroke-linecap="round"/>
  <text x="${PAD+56}" y="30" font-family="sans-serif" font-size="18" font-weight="800" fill="#0f172a">Boshlang'ich <tspan fill="#2d5f8a">A1</tspan></text>
  <text x="${PAD+56}" y="47" font-family="sans-serif" font-size="12" font-weight="600" fill="#475569">1 / 3 dars o'tildi</text>
  <rect x="${PAD}" y="58" width="${CW-40}" height="8" rx="4" fill="rgba(255,255,255,0.55)"/>
  <rect x="${PAD}" y="58" width="${(CW-40)*0.5}" height="8" rx="4" fill="#3fc9e4"/>
  <text x="${W-PAD}" y="66" text-anchor="end" font-family="sans-serif" font-size="13" font-weight="800" fill="#134e5e">50%</text>
  ${parts.join("\n")}
</svg>`;
await sharp(Buffer.from(svg)).png().toFile("/tmp/brain-preview.png");
console.log(`/tmp/brain-preview.png (${W}x${H})`);
