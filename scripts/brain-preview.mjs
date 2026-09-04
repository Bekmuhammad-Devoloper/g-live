// Daraja sahifasini (neyron yo'li) HAQIQIY o'lchamda chizib ko'rish.
//   node scripts/brain-preview.mjs   →   /tmp/brain-preview.png
// Ishlab chiqarish kodi emas: dizaynni ko'z bilan tekshirish uchun.
// page.tsx dagi qiymatlar bilan qo'lda mos yuritiladi.

import sharp from "sharp";

const TEAL = "#0e7490", NAVY = "#134e5e";
const W = 360, PAD = 16, CW = W - PAD * 2; // kontent kengligi = 328
const COL = 0.46; // w-[46%]
const BRAIN = 88;

const OUTER =
  "M62 8C48 3 33 7 26 18 14 21 8 34 13 45 4 53 5 68 15 74c1 11 12 18 23 15 6 7 17 9 25 3 9 6 21 3 26-5 12 1 22-9 21-21 8-8 7-22-3-28 2-13-8-24-21-24-5-5-15-9-24-6Z";
const FOLDS = [
  "M61 9c-2 20 2 38-1 78",
  "M42 22c-8 6-5 15 3 19-9 4-10 15-2 20",
  "M80 22c8 6 5 15-3 19 9 4 10 15 2 20",
  "M32 36c6 3 7 10 3 14",
  "M90 36c-6 3-7 10-3 14",
];

const LESSONS = [
  { title: "Begrüßung und Vorstellung", state: "done" },
  { title: "Zahlen von 1 bis 100", state: "current" },
  { title: "Die Familie", state: "upcoming" },
];

function brain(state, x, y) {
  const fill = state === "done" ? "url(#gGold)" : state === "current" ? "url(#gTeal)" : "rgba(255,255,255,0.62)";
  const edge = state === "upcoming" ? "#9db9c6" : "rgba(255,255,255,0.9)";
  const fold = state === "upcoming" ? "#9db9c6" : "rgba(255,255,255,0.8)";
  return `<svg x="${x}" y="${y}" width="${BRAIN}" height="${BRAIN}" viewBox="0 0 120 120" overflow="visible">
    <path d="${OUTER}" fill="${fill}" stroke="${edge}" stroke-width="2.4" stroke-linejoin="round"/>
    ${FOLDS.map((d) => `<path d="${d}" fill="none" stroke="${fold}" stroke-width="2.2" stroke-linecap="round"/>`).join("")}
  </svg>`;
}

// Tugun bloki: miya + "Unit x.y" + dars nomi + holat yorlig'i
const NODE_H = BRAIN + 6 + 15 + 4 + 26 + 4 + 16; // ≈ taxminiy balandlik
const AXON_H = 56;

let y = 74; // sarlavha + progress ostidan
const parts = [];

LESSONS.forEach((l, i) => {
  const right = i % 2 === 1;
  const cx = PAD + CW * (right ? 0.77 : 0.23);
  const lit = l.state !== "upcoming";

  if (i > 0) {
    const from = right ? 0.23 : 0.77, to = right ? 0.77 : 0.23;
    const fx = PAD + CW * from, tx = PAD + CW * to;
    parts.push(`<path d="M${fx} ${y} C${fx} ${y + 30}, ${tx} ${y + 26}, ${tx} ${y + AXON_H}"
      fill="none" stroke="${lit ? TEAL : "#a9c4d1"}" stroke-opacity="${lit ? 0.85 : 0.7}"
      stroke-width="${lit ? 4 : 3}" stroke-linecap="round" ${lit ? "" : 'stroke-dasharray="7 10"'}/>`);
    if (lit) parts.push(`<circle cx="${(fx + tx) / 2}" cy="${y + 28}" r="5" fill="${TEAL}" opacity="0.9"/>`);
    y += AXON_H;
  }

  if (l.state === "current") {
    parts.push(`<rect x="${cx - BRAIN / 2 - 9}" y="${y - 9}" width="${BRAIN + 18}" height="${BRAIN + 18}" rx="${(BRAIN + 18) / 2}" fill="none" stroke="${TEAL}" stroke-opacity="0.3" stroke-width="2.5"/>`);
  }
  parts.push(brain(l.state, cx - BRAIN / 2, y));
  if (l.state === "done") {
    const bx = cx + BRAIN / 2 - 12, by = y;
    parts.push(`<circle cx="${bx}" cy="${by + 13}" r="13" fill="${TEAL}" stroke="#fff" stroke-width="2.5"/>
      <path d="M${bx - 6} ${by + 13.5}l4.5 4.5L${bx + 6.5} ${by + 8}" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`);
  }

  const ty = y + BRAIN + 6;
  const chapter = Math.floor(i / 3) + 1, inCh = (i % 3) + 1;
  parts.push(`<text x="${cx}" y="${ty + 12}" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="800" fill="#0f172a">Unit ${chapter}.${inCh}</text>`);
  // dars nomi — ikki qatorgacha
  const words = l.title.split(" ");
  const line1 = words.slice(0, 2).join(" "), line2 = words.slice(2).join(" ");
  parts.push(`<text x="${cx}" y="${ty + 28}" text-anchor="middle" font-family="sans-serif" font-size="11.5" fill="#475569">${line1}</text>`);
  if (line2) parts.push(`<text x="${cx}" y="${ty + 41}" text-anchor="middle" font-family="sans-serif" font-size="11.5" fill="#475569">${line2}</text>`);

  const badge = l.state === "done" ? "O'TILDI" : l.state === "current" ? "JORIY DARS" : "NAVBATDA";
  const bcol = l.state === "done" ? "#9a5f14" : l.state === "current" ? NAVY : "#475569";
  const bbg = l.state === "done" ? "rgba(224,146,23,0.16)" : l.state === "current" ? "rgba(14,116,144,0.14)" : "rgba(148,163,184,0.16)";
  const bw = badge.length * 6.2 + 16;
  parts.push(`<rect x="${cx - bw / 2}" y="${ty + (line2 ? 48 : 35)}" width="${bw}" height="17" rx="8.5" fill="${bbg}"/>
    <text x="${cx}" y="${ty + (line2 ? 60 : 47)}" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="700" fill="${bcol}">${badge}</text>`);

  y += NODE_H;
});

// yakun
parts.push(`<path d="M${W / 2} ${y} v34" stroke="#a9c4d1" stroke-opacity="0.7" stroke-width="3" stroke-linecap="round" stroke-dasharray="7 9"/>`);
const fy = y + 40;
parts.push(`<rect x="${(W - 300) / 2}" y="${fy}" width="300" height="118" rx="22" fill="rgba(255,255,255,0.5)" stroke="rgba(255,255,255,0.9)"/>
  <circle cx="${W / 2}" cy="${fy + 34}" r="26" fill="rgba(255,255,255,0.75)"/>
  <text x="${W / 2}" y="${fy + 80}" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="800" fill="#0f172a">Daraja yakuni</text>
  <text x="${W / 2}" y="${fy + 99}" text-anchor="middle" font-family="sans-serif" font-size="12.5" fill="#475569">Barcha darsni o'tsangiz shu yerga yetasiz</text>`);

const H = fy + 140;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="gGold" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0%" stop-color="#ffdc7a"/><stop offset="55%" stop-color="#fbc63f"/><stop offset="100%" stop-color="#e09217"/>
    </linearGradient>
    <linearGradient id="gTeal" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0%" stop-color="#2fb9dc"/><stop offset="60%" stop-color="${TEAL}"/><stop offset="100%" stop-color="${NAVY}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="#eef3f6"/>
  <circle cx="${PAD + 22}" cy="34" r="22" fill="rgba(255,255,255,0.55)"/>
  <path d="M${PAD + 28} 26l-8 8 8 8" fill="none" stroke="${TEAL}" stroke-width="2.4" stroke-linecap="round"/>
  <text x="${PAD + 56}" y="30" font-family="sans-serif" font-size="18" font-weight="800" fill="#0f172a">Boshlang'ich <tspan fill="#6d28d9">A1</tspan></text>
  <text x="${PAD + 56}" y="46" font-family="sans-serif" font-size="12" font-weight="600" fill="#475569">1 / 3 dars o'tildi</text>
  <rect x="${PAD}" y="58" width="${CW - 40}" height="8" rx="4" fill="rgba(255,255,255,0.55)"/>
  <rect x="${PAD}" y="58" width="${(CW - 40) / 3}" height="8" rx="4" fill="#fbc63f"/>
  <text x="${W - PAD}" y="66" text-anchor="end" font-family="sans-serif" font-size="13" font-weight="800" fill="${NAVY}">33%</text>
  ${parts.join("\n")}
</svg>`;

await sharp(Buffer.from(svg)).png().toFile("/tmp/brain-preview.png");
console.log(`/tmp/brain-preview.png  (${W}x${H})`);
