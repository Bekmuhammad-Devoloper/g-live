import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SRC = "public/logo-dark.png";
const OUT = "public/icons";

const BG_TOP = "#12708c";
const BG_BOTTOM = "#0a3b4c";

await mkdir(OUT, { recursive: true });

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

const mark = await sharp(SRC)
  .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
  .png()
  .toBuffer();

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

await make(192, 0.86, "icon-192.png");
await make(512, 0.86, "icon-512.png");

await make(192, 0.68, "maskable-192.png");
await make(512, 0.68, "maskable-512.png");

await make(180, 0.86, "apple-touch-icon.png");

const CAP = "capacitor/assets";
await mkdir(CAP, { recursive: true });

const S = 1024;
const transparent = { create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } };

await (await place(background(S), S, 0.86)).png().toFile(`${CAP}/icon.png`);
console.log(`capacitor/assets/icon.png  ${S}x${S}`);

await (await place(transparent, S, 0.56)).png().toFile(`${CAP}/icon-foreground.png`);
console.log(`capacitor/assets/icon-foreground.png  ${S}x${S}`);

await sharp(background(S)).png().toFile(`${CAP}/icon-background.png`);
console.log(`capacitor/assets/icon-background.png  ${S}x${S}`);

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
await capSplash("splash-dark.png", "#0a3b4c", "#062634");
