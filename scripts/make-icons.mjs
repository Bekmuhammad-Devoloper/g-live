// Ilova ikonkalari — PWA va Android (TWA/APK) uchun.
//
//   node scripts/make-icons.mjs
//
// MUHIM: ilova ikonkasi WORDMARK BO'LMAYDI. Ilgari bu skript butun
// gorizontal logotipni (1979x757, "G" + GERMANIYA LIVE yozuvi) kvadratga
// siqardi: launcher'da 48dp da yozuv o'qilmasdi, qora matn to'q feruzada
// yo'qolardi va atrofi bo'm-bo'sh qolardi — ikonka "buzuq" ko'rinardi.
//
// Endi logotipdan faqat "G + burgut" MONOGRAMMASI olinadi. U kvadratga
// yaqin, o'ziga xos va kichik o'lchamda ham tanilib turadi.
//
// Monogramma qo'lda kesilmaydi — skript uni RANG bo'yicha topadi: monogramma
// to'q sariq/qizil, yozuv esa qora. Shu sabab logotip yangilansa ham ishlaydi.

import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SRC = "public/logo.png";
const OUT = "public/icons";

// Fon — brend feruzasining chuqur varianti. To'q sariq monogramma unda
// yorqin ko'rinadi; tekis rang o'rniga gradient + yumshoq nur beriladi.
const BG_TOP = "#12708c";
const BG_BOTTOM = "#0a3b4c";

await mkdir(OUT, { recursive: true });

/** Logotipdagi rangli (to'q sariq) monogramma chegarasini topadi */
async function monogramBox() {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;

  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * C;
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
      if (a < 40) continue;
      // To'q sariq/qizil: qizil kanal ko'k kanaldan sezilarli baland.
      // Qora yozuvda uch kanal ham deyarli teng, shu sabab u tushib qoladi.
      if (r > 110 && r - b > 55 && r >= g - 10) {
        n++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (n < 500) throw new Error("monogramma topilmadi — logotip ranglari o'zgardimi?");
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1, pixels: n };
}

const box = await monogramBox();
console.log(`monogramma: ${box.width}x${box.height} @ ${box.left},${box.top} (${box.pixels} piksel)`);

// Monogrammani bir marta kesib, shaffof fonli buferga olamiz
const mark = await sharp(SRC)
  .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
  .png()
  .toBuffer();

/** Gradient fon (SVG) — sharp uni to'g'ridan-to'g'ri rasterlaydi */
const background = (size) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="${BG_TOP}"/>
      <stop offset="100%" stop-color="${BG_BOTTOM}"/>
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
 * @param size    kvadrat tomoni
 * @param ratio   monogramma egallaydigan ulush (maskable'da kichikroq)
 * @param name    fayl nomi
 */
async function make(size, ratio, name) {
  const target = Math.round(size * ratio);
  // Monogramma bo'yi enidan uzunroq, shuning uchun "inside": ikkala o'lcham
  // ham chegaradan chiqmaydi va nisbat saqlanadi.
  const logo = await sharp(mark).resize({ width: target, height: target, fit: "inside" }).toBuffer();
  const lm = await sharp(logo).metadata();

  await sharp(background(size))
    .composite([{
      input: logo,
      top: Math.round((size - (lm.height ?? 0)) / 2),
      left: Math.round((size - (lm.width ?? 0)) / 2),
    }])
    .png()
    .toFile(`${OUT}/${name}`);
  console.log(`${name}  ${size}x${size}  monogramma ${lm.width}x${lm.height}`);
}

// "any" — ikonka to'liq ko'rinadi, monogramma kattaroq bo'lishi mumkin
await make(192, 0.66, "icon-192.png");
await make(512, 0.66, "icon-512.png");

// "maskable" — Android ikonkani doira/kvadrat qilib QIRQADI. Xavfsiz zona
// markazdagi 80% doira; monogramma unga bemalol sig'ishi uchun 0.5.
await make(192, 0.5, "maskable-192.png");
await make(512, 0.5, "maskable-512.png");

// Apple "bosh ekranga qo'shish" — shaffof fon ishlatmaydi, radiusni o'zi qo'yadi
await make(180, 0.66, "apple-touch-icon.png");

// ────────────────────────────────────────────────────────────────────
// Capacitor (Android ilovasi) uchun manba rasmlar
//
// @capacitor/assets shu papkadan o'qib, Android talab qiladigan o'nlab
// o'lchamni (mdpi...xxxhdpi, adaptiv ikonka, splash) o'zi yasaydi.
//
// Android 8 dan beri ikonka ADAPTIV: tizim old qatlamni orqa qatlam
// ustiga qo'yib, qurilma shakli bo'yicha (doira, kvadrat, tomchi)
// qirqadi. Shu sabab old qatlam SHAFFOF fonli va markazda kichikroq
// bo'lishi kerak — chetlari qirqilib ketmasin.
// ────────────────────────────────────────────────────────────────────

const CAP = "capacitor/assets";
await mkdir(CAP, { recursive: true });

/** To'liq ikonka (fon + monogramma) — 1024px, adaptiv bo'lmagan joylar uchun */
async function capIcon() {
  const size = 1024;
  const target = Math.round(size * 0.66);
  const logo = await sharp(mark).resize({ width: target, height: target, fit: "inside" }).toBuffer();
  const lm = await sharp(logo).metadata();
  await sharp(background(size))
    .composite([{ input: logo, top: Math.round((size - (lm.height ?? 0)) / 2), left: Math.round((size - (lm.width ?? 0)) / 2) }])
    .png()
    .toFile(`${CAP}/icon.png`);
  console.log(`capacitor/assets/icon.png  ${size}x${size}`);
}

/** Adaptiv ikonkaning old qatlami — shaffof fon, xavfsiz zonada monogramma */
async function capForeground() {
  const size = 1024;
  // 0.45: adaptiv ikonkada tashqi ~33% qirqilishi mumkin, monogramma
  // markazdagi xavfsiz doiradan chiqmasligi shart.
  const target = Math.round(size * 0.45);
  const logo = await sharp(mark).resize({ width: target, height: target, fit: "inside" }).toBuffer();
  const lm = await sharp(logo).metadata();
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: logo, top: Math.round((size - (lm.height ?? 0)) / 2), left: Math.round((size - (lm.width ?? 0)) / 2) }])
    .png()
    .toFile(`${CAP}/icon-foreground.png`);
  console.log(`capacitor/assets/icon-foreground.png  ${size}x${size}`);
}

/** Adaptiv ikonkaning orqa qatlami — faqat gradient */
async function capBackground() {
  const size = 1024;
  await sharp(background(size)).png().toFile(`${CAP}/icon-background.png`);
  console.log(`capacitor/assets/icon-background.png  ${size}x${size}`);
}

/**
 * Ochilish ekrani — 2732x2732 kvadrat.
 * Android uni CENTER_CROP bilan ko'rsatadi: telefon qanday nisbatda
 * bo'lmasin, markaz doim ko'rinadi. Shu sabab monogramma kichik (12%)
 * va qat'iy markazda — hech qaysi qurilmada kesilmaydi.
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
  const target = Math.round(size * 0.12);
  const logo = await sharp(mark).resize({ width: target, height: target, fit: "inside" }).toBuffer();
  const lm = await sharp(logo).metadata();
  await sharp(bg)
    .composite([{ input: logo, top: Math.round((size - (lm.height ?? 0)) / 2), left: Math.round((size - (lm.width ?? 0)) / 2) }])
    .png()
    .toFile(`${CAP}/${name}`);
  console.log(`capacitor/assets/${name}  ${size}x${size}`);
}

await capIcon();
await capForeground();
await capBackground();
await capSplash("splash.png", "#12708c", "#0a3b4c");
// Qorong'i rejim uchun to'qroq variant
await capSplash("splash-dark.png", "#0a3b4c", "#062634");
