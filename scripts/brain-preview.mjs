// Miya tugunini CHIZIB KO'RISH uchun vaqtinchalik yordamchi.
//   node scripts/brain-preview.mjs   →   /tmp/brain-preview.png
// Ishlab chiqarish kodi emas: dizaynni ko'z bilan tekshirish uchun.

import sharp from "sharp";

const TEAL = "#0e7490", NAVY = "#134e5e";

// Tanlangan shakl: A ning tiniq konturi + B ning burmalari, tepasi biroz
// notekis (miya xarakteri shundan) — lekin telefon o'lchamida sodda qoladi.
const BRAIN = {
  outer:
    "M62 8C48 3 33 7 26 18 14 21 8 34 13 45 4 53 5 68 15 74c1 11 12 18 23 15 6 7 17 9 25 3 9 6 21 3 26-5 12 1 22-9 21-21 8-8 7-22-3-28 2-13-8-24-21-24-5-5-15-9-24-6Z",
  folds: [
    "M61 9c-2 20 2 38-1 78",
    "M42 22c-8 6-5 15 3 19-9 4-10 15-2 20",
    "M80 22c8 6 5 15-3 19 9 4 10 15 2 20",
    "M32 36c6 3 7 10 3 14",
    "M90 36c-6 3-7 10-3 14",
  ],
};

const VB = 120; // viewBox
const STATES = ["done", "current", "upcoming"];

function brain(state, px) {
  const fill = state === "done" ? "url(#gDone)" : state === "current" ? "url(#gCur)" : "rgba(255,255,255,0.6)";
  const stroke = state === "upcoming" ? "#9db9c6" : "rgba(255,255,255,0.9)";
  const fold = state === "upcoming" ? "#9db9c6" : "rgba(255,255,255,0.8)";
  const sw = (2.4 * VB) / 120;
  return `
  <svg x="0" y="0" width="${px}" height="${px}" viewBox="0 0 ${VB} ${VB}" overflow="visible">
    <path d="${BRAIN.outer}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
    ${BRAIN.folds.map((f) => `<path d="${f}" fill="none" stroke="${fold}" stroke-width="${sw * 0.92}" stroke-linecap="round"/>`).join("")}
  </svg>`;
}

// Har holat uchun: katta (tekshirish) va telefondagi haqiqiy o'lcham (96px)
const SIZES = [120, 96, 64];
const CELL = 150, ROW = 170;

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${CELL * 3 + 40}" height="${ROW * SIZES.length + 40}">
  <defs>
    <linearGradient id="gDone" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0%" stop-color="#ffdc7a"/><stop offset="55%" stop-color="#fbc63f"/><stop offset="100%" stop-color="#e09217"/>
    </linearGradient>
    <linearGradient id="gCur" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0%" stop-color="#2fb9dc"/><stop offset="60%" stop-color="${TEAL}"/><stop offset="100%" stop-color="${NAVY}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="#eef3f6"/>
  ${SIZES.map((px, r) => `
    <text x="20" y="${28 + r * ROW}" font-family="sans-serif" font-size="12" font-weight="700" fill="#0f172a">${px}px</text>
    ${STATES.map((s, i) => `
      <g transform="translate(${20 + i * CELL + (120 - px) / 2}, ${38 + r * ROW})">
        ${s === "current" ? `<circle cx="${px/2}" cy="${px/2}" r="${px*0.62}" fill="none" stroke="${TEAL}" stroke-opacity="0.30" stroke-width="2.5"/>` : ""}
        ${brain(s, px)}
        ${s === "done" ? `<g transform="translate(${px*0.72}, ${px*0.04})"><circle cx="${px*0.14}" cy="${px*0.14}" r="${px*0.155}" fill="#0e7490" stroke="#fff" stroke-width="${px*0.028}"/><path d="M${px*0.075} ${px*0.145}l${px*0.045} ${px*0.05} ${px*0.085}-${px*0.10}" fill="none" stroke="#fff" stroke-width="${px*0.032}" stroke-linecap="round" stroke-linejoin="round"/></g>` : ""}
        <text x="${px / 2}" y="${px + 18}" font-family="sans-serif" font-size="13" font-weight="800" fill="#0f172a" text-anchor="middle">Unit 1.${i + 1}</text>
      </g>`).join("")}
  `).join("")}
</svg>`;

await sharp(Buffer.from(svg)).png().toFile("/tmp/brain-preview.png");
console.log("/tmp/brain-preview.png");
