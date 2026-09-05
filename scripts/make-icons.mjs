// Ilova ikonkalari — PWA va Android (Capacitor) uchun.
//
//   node scripts/make-icons.mjs
//
// Ikonka — TO'LIQ LOGOTIP: "G + burgut" monogrammasi va "GERMANIYA LIVE"
// yozuvi birga, feruza gradient fonda. Foydalanuvchi shuni so'radi
// (2026-09-05): "ilova ikonasi Germaniya Live logotipi bo'lsin, orqasi
// hozirgidek feruza".
//
// Manba — public/logo-dark.png. Bu public/logo.png ning aynan o'zi, faqat
// yozuvi OQ: to'q feruzada qora yozuv yo'qolib ketardi, oq esa aniq
// ko'rinadi. (Ilgari shu sababdan faqat monogramma ishlatilgan edi; endi
// oq yozuvli manba borligi uchun to'liq logotip ham o'qiladi.)
//
// Logotip qo'lda kesilmaydi — skript uning chegarasini shaffof bo'lmagan
// piksellar bo'yicha topadi. Manba fayl yangilansa ham ishlayveradi.
//
// Logotip 2.6:1 nisbatda (eni bo'yidan ancha katta). Kvadrat ikonkada u
// eni bo'yicha to'ldiradi va tepa-pastda bo'sh joy qoladi — bu normal,
// gradient fon shu joyni "dizayn" qilib ko'rsatadi.

import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SRC = "public/logo-dark.png";
const OUT = "public/icons";

// Fon — brend feruzasining chuqur varianti. To'q sariq monogramma va oq
// yozuv unda yorqin ko'rinadi; tekis rang o'rniga gradient + yumshoq nur.
const BG_TOP = "#12708c";
const BG_BOTTOM = "#0a3b4c";

await mkdir(OUT, { recursive: true });

/** Logotipning shaffof bo'lmagan qismi chegarasi */
async function logoBox() {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;

  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * C;
      if (data[i + 3] < 40) continue;
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (n < 500) throw new Error("logotip topilmadi — manba fayl bo'shmi?");
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1, pixels: n };
}

const box = await logoBox();
console.log(`logotip: ${box.width}x${box.height} @ ${box.left},${box.top} (${box.pixels} piksel)`);

// Logotipni bir marta kesib, shaffof fonli buferga olamiz
const mark = await sharp(SRC)
  .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
  .png()
  .toBuffer();

/** Gradient fon (SVG) — sharp uni to'g'ridan-to'g'ri rasterlaydi */
const background = (size, top = BG_TOP, bottom = BG_BOTTOM) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="${top}"/>
      <stop offset="100%" stop-color="${bottom}"/>
    </linearGradient>
    <radialGradient id="s" cx="0.3" cy="0.22" r="0.75">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <rect width="${size}" height="${size}" fill="url(#s)"/>
</svg>`);

/**
 * Logotipni berilgan ENGA moslab, kvadrat markaziga qo'yadi.
 * @param base   fon buferi (gradient yoki shaffof)
 * @param size   kvadrat tomoni
 * @param ratio  logotip eni kvadrat enining qancha ulushi
 */
async function place(base, size, ratio) {
  const logo = await sharp(mark).resize({ width: Math.round(size * ratio), fit: "inside" }).toBuffer();
  const lm = await sharp(logo).metadata();
  return sharp(base).composite([{
    input: logo,
    top: Math.round((size - (lm.height ?? 0)) / 2),
    left: Math.round((size - (lm.width ?? 0)) / 2),
  }]);
}

async function make(size, ratio, name) {
  await (await place(background(size), size, ratio)).png().toFile(`${OUT}/${name}`);
  console.log(`${name}  ${size}x${size}  logotip eni ${Math.round(ratio * 100)}%`);
}

// ── PWA / brauzer ikonkalari ──
// "any" — ikonka to'liq ko'rinadi, logotip kengroq bo'lishi mumkin
await make(192, 0.86, "icon-192.png");
await make(512, 0.86, "icon-512.png");

// "maskable" — Android ikonkani doira/kvadrat qilib QIRQADI. Xavfsiz zona
// markazdagi 80% doira; keng logotip unga sig'ishi uchun 0.68.
await make(192, 0.68, "maskable-192.png");
await make(512, 0.68, "maskable-512.png");

// Apple "bosh ekranga qo'shish" — shaffof fon ishlatmaydi, radiusni o'zi qo'yadi
await make(180, 0.86, "apple-touch-icon.png");

// ────────────────────────────────────────────────────────────────────
// Capacitor (Android ilovasi) uchun manba rasmlar
//
// @capacitor/assets shu papkadan o'qib, Android talab qiladigan o'nlab
// o'lchamni (mdpi...xxxhdpi, adaptiv ikonka, splash) o'zi yasaydi.
//
// Android 8 dan beri ikonka ADAPTIV: 108dp kanvasdan tizim markazdagi
// ~72dp ni ko'rsatadi va qurilma shakli bo'yicha (doira, kvadrat, tomchi)
// qirqadi. Ya'ni 108 kanvasdagi 0.56 ulush = ko'rinadigan 72 ning 0.84
// ulushi. Doira maskada ham sig'adi: logotip bo'yi eni ning 26% i,
// shuning uchun uning yuqori-pastki chetlari doira qirrasidan ancha ichkarida.
//
// DIQQAT: @capacitor/assets adaptiv XML ga qo'shimcha <inset 16.7%> qo'yadi
// va ikonkani yana kichraytiradi — scripts/fix-adaptive-icon.mjs uni olib
// tashlaydi (npm run app:icons ichida avtomatik).
// ────────────────────────────────────────────────────────────────────

const CAP = "capacitor/assets";
await mkdir(CAP, { recursive: true });

const S = 1024;
const transparent = { create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } };

// To'liq ikonka (fon + logotip) — adaptiv bo'lmagan joylar uchun
await (await place(background(S), S, 0.86)).png().toFile(`${CAP}/icon.png`);
console.log(`capacitor/assets/icon.png  ${S}x${S}`);

// Adaptiv old qatlam — shaffof fon, 108 kanvasning 56% i (= ko'rinadigan 72 ning 84% i)
await (await place(transparent, S, 0.56)).png().toFile(`${CAP}/icon-foreground.png`);
console.log(`capacitor/assets/icon-foreground.png  ${S}x${S}`);

// Adaptiv orqa qatlam — faqat gradient
await sharp(background(S)).png().toFile(`${CAP}/icon-background.png`);
console.log(`capacitor/assets/icon-background.png  ${S}x${S}`);

/**
 * Ochilish ekrani — 2732x2732 kvadrat.
 * Android uni CENTER_CROP bilan ko'rsatadi: telefon qanday nisbatda
 * bo'lmasin, markaz doim ko'rinadi. Shu sabab logotip ixcham (eni 34%)
 * va qat'iy markazda — hech qaysi qurilmada kesilmaydi. Nur (radial)
 * splash'da yo'q — tekis gradient.
 */
async function capSplash(name, top, bottom) {
  const size = 2732;
  const bg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="${top}"/>
      <stop offset="100%" stop-color="${bottom}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
</svg>`);
  await (await place(bg, size, 0.34)).png().toFile(`${CAP}/${name}`);
  console.log(`capacitor/assets/${name}  ${size}x${size}`);
}

await capSplash("splash.png", "#12708c", "#0a3b4c");
// Qorong'i rejim uchun to'qroq variant
await capSplash("splash-dark.png", "#0a3b4c", "#062634");
