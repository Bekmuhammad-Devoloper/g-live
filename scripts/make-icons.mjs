// Ilova ikonkalari — PWA va APK uchun.
// Logotip keng (1979x757), shuning uchun uni kvadrat feruza fon ustiga
// markazga joylaymiz. maskable variantida atrofda bo'sh joy ko'proq
// (Android ikonkani doira/kvadrat qilib qirqadi).
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const OUT = "public/icons";
const BG = { r: 14, g: 116, b: 144, alpha: 1 }; // #0e7490

await mkdir(OUT, { recursive: true });

async function make(size, padRatio, name) {
  const inner = Math.round(size * padRatio);
  const logo = await sharp("public/logo.png")
    .resize({ width: inner, fit: "inside", withoutEnlargement: false })
    .toBuffer();
  const meta = await sharp(logo).metadata();

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{
      input: logo,
      top: Math.round((size - (meta.height ?? 0)) / 2),
      left: Math.round((size - (meta.width ?? 0)) / 2),
    }])
    .png()
    .toFile(`${OUT}/${name}`);
  console.log(name, `${size}x${size}`);
}

await make(192, 0.78, "icon-192.png");
await make(512, 0.78, "icon-512.png");
// maskable — chetlarida zaxira joy (safe zone 80%)
await make(192, 0.58, "maskable-192.png");
await make(512, 0.58, "maskable-512.png");
// Apple uchun (shaffof fon ishlatmaydi)
await make(180, 0.78, "apple-touch-icon.png");
