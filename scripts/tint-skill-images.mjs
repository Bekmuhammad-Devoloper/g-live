/**
 * Ko'nikma kartalari rasmlarini brend rangiga bo'yaydi.
 *
 * public/skills/ dagi rasmlar juda och kulrang chiziqli chizma edi —
 * telefonda deyarli ko'rinmasdi. Shakl alfa kanalda saqlanadi, shu sabab
 * piksellarning rangini feruzaga almashtirib, alfani (chiziq qalinligini)
 * o'z holicha qoldiramiz. Rangli illyustratsiya tashlansa — "--only-gray"
 * (sukut bo'yicha) uni tegmasdan o'tkazib yuboradi.
 *
 *   node scripts/tint-skill-images.mjs           — nima o'zgarishini aytadi
 *   node scripts/tint-skill-images.mjs --apply   — rasmlarni yangilaydi
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DIR = path.join(process.cwd(), "public", "skills");
const apply = process.argv.includes("--apply");
const force = process.argv.includes("--force"); // rangli rasmlarni ham bo'yash

// Brend feruzasi (student portali: TEAL / ICON_GRADIENT)
const TINT = { r: 14, g: 116, b: 144 };
// Juda och piksellar ko'rinmaydi — alfani biroz kuchaytiramiz
const ALPHA_BOOST = 1.35;

const files = [];
for (const skill of fs.readdirSync(DIR)) {
  const sub = path.join(DIR, skill);
  if (!fs.statSync(sub).isDirectory()) continue;
  for (const f of fs.readdirSync(sub)) if (f.endsWith(".png")) files.push(path.join(sub, f));
}

let tinted = 0;
let skipped = 0;

for (const file of files) {
  const img = sharp(file);
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = info.width * info.height;

  // Rasm ekranda o'qiladimi? Chiziqlari juda och bo'lsa (och kulrang yoki
  // och havorang) 40-56px da ko'rinmaydi — shundaylarini bo'yaymiz.
  // To'yingan, to'q illyustratsiya bo'lsa tegmaymiz.
  let visible = 0;
  let lumSum = 0;
  for (let i = 0; i < px; i++) {
    const o = i * 4;
    if (data[o + 3] < 20) continue;
    visible++;
    lumSum += (data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114) / 255;
  }
  const meanLum = visible ? lumSum / visible : 0;
  const tooLight = visible === 0 || meanLum > 0.68;

  if (!tooLight && !force) {
    skipped++;
    console.log(`  = ${path.relative(DIR, file)} — yetarli to'q (${meanLum.toFixed(2)}), tegilmadi`);
    continue;
  }

  // Shakl alfa kanalda — rangni to'liq brend feruzasiga almashtiramiz.
  // (Manba rangiga bog'lasak, och chizma yana och chiqadi.)
  for (let i = 0; i < px; i++) {
    const o = i * 4;
    const a = data[o + 3];
    if (a === 0) continue;
    data[o] = TINT.r;
    data[o + 1] = TINT.g;
    data[o + 2] = TINT.b;
    data[o + 3] = Math.min(255, Math.round(a * ALPHA_BOOST));
  }

  tinted++;
  console.log(`  ~ ${path.relative(DIR, file)} — och edi (${meanLum.toFixed(2)}), bo'yaldi`);
  if (apply) {
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png({ compressionLevel: 9 })
      .toFile(file + ".tmp");
    fs.renameSync(file + ".tmp", file);
  }
}

console.log(`\nrasmlar: ${files.length} | bo'yaladi: ${tinted} | tegilmaydi: ${skipped}`);
if (!apply) console.log("(--apply berilmadi — fayllar o'zgarmadi)");
