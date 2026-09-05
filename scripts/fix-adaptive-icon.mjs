// Adaptiv ikonkani @capacitor/assets dan keyin TO'G'RILAYDI.
//
//   node scripts/fix-adaptive-icon.mjs
//
// `npm run app:icons` ning oxirida avtomatik chaqiriladi, chunki
// @capacitor/assets har safar bu fayllarni qaytadan yozib yuboradi.
//
// Ikki muammo tuzatiladi:
//
// 1. KERAKSIZ SIQISH. @capacitor/assets ikkala qatlamni ham
//    `<inset android:inset="16.7%">` ichiga o'raydi. Natijada FON 16.7% ga
//    kichrayib chetlarida bo'sh joy qoladi, LOGO esa ikki marta kichrayadi —
//    biz uni allaqachon xavfsiz zonaga moslab chizganmiz. Android o'zi
//    108dp kanvasdan markazdagi ~72dp ni ko'rsatadi, ya'ni siqish tizimning
//    ichida bor — qo'lda takrorlash shart emas.
//
// 2. NOTO'G'RI O'LCHAM. Adaptiv qatlam 108dp kanvas: mdpi 108px, hdpi 162,
//    xhdpi 216, xxhdpi 324, xxxhdpi 432. @capacitor/assets esa ularni ODDIY
//    ikonka o'lchamida (48…192px) chiqaradi va Android ko'rsatishda 2.25×
//    kattalashtiradi — "GERMANIYA LIVE" yozuvi xiralashib ketadi. Shu
//    sabab qatlamlar 1024px manbadan to'g'ri o'lchamda qaytadan chiziladi.

import { readdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const RES = "android/app/src/main/res";
const ANYDPI = `${RES}/mipmap-anydpi-v26`;

// ── 1. <inset> ni olib tashlash ──

const XML = `<?xml version="1.0" encoding="utf-8"?>
<!--
    DIQQAT: qatlamlar ATAYLAB <inset> siz.
    Tafsilot uchun: scripts/fix-adaptive-icon.mjs
-->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;

for (const f of (await readdir(ANYDPI)).filter((f) => f.endsWith(".xml"))) {
  const path = `${ANYDPI}/${f}`;
  const before = await readFile(path, "utf8");
  if (!before.includes("<inset")) {
    console.log(`${f} — allaqachon to'g'ri`);
    continue;
  }
  await writeFile(path, XML);
  console.log(`${f} — siqish olib tashlandi`);
}

// ── 2. Qatlamlarni to'g'ri o'lchamda qayta chizish ──

// Zichlik → 108dp kanvasning piksel o'lchami
const SIZES = { ldpi: 81, mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

const LAYERS = [
  ["capacitor/assets/icon-foreground.png", "ic_launcher_foreground.png"],
  ["capacitor/assets/icon-background.png", "ic_launcher_background.png"],
];

for (const [density, px] of Object.entries(SIZES)) {
  const dir = `${RES}/mipmap-${density}`;
  let ok = true;
  try {
    await readdir(dir);
  } catch {
    ok = false; // bu zichlik uchun papka yo'q (masalan ldpi) — o'tkazib yuboramiz
  }
  if (!ok) continue;

  for (const [src, name] of LAYERS) {
    await sharp(src).resize(px, px, { kernel: "lanczos3" }).png().toFile(`${dir}/${name}`);
  }
  console.log(`mipmap-${density}: qatlamlar ${px}x${px}`);
}

console.log("\nTayyor");
