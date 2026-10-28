import { readdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const RES = "android/app/src/main/res";
const ANYDPI = `${RES}/mipmap-anydpi-v26`;

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
    ok = false;
  }
  if (!ok) continue;

  for (const [src, name] of LAYERS) {
    await sharp(src).resize(px, px, { kernel: "lanczos3" }).png().toFile(`${dir}/${name}`);
  }
  console.log(`mipmap-${density}: qatlamlar ${px}x${px}`);
}

console.log("\nTayyor");
