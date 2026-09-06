// Server komponentdan "use client" faylning oddiy funksiyasini chaqirishni
// topadi.
//
//   node scripts/check-client-boundary.mjs
//
// NEGA KERAK. 2026-09-07 da lug'at sahifasi ochilmay qoldi: server
// komponenti "use client" fayldan `practicable()` funksiyasini import qilib
// chaqirgan edi. Next bunga yo'l qo'ymaydi:
//
//   Attempted to call practicable() from the server but practicable is on
//   the client.
//
// Eng yomoni — `tsc` ham, `next build` ham buni TUTMAYDI. Tiplar to'g'ri,
// kod kompilyatsiya bo'ladi; xato faqat o'sha sahifa ochilganda chiqadi.
// Ya'ni foydalanuvchi topadi, biz emas.
//
// QOIDA. "use client" fayldan server fayliga faqat KOMPONENT (JSX da
// chiziladigan) va TIP chiqarilishi mumkin. Ikkala tomon ishlatadigan oddiy
// funksiya/qiymat esa neytral faylda (masalan src/lib/) turishi kerak.
//
// ANIQLASH. Nom bilan ajratamiz: React komponenti Bosh Harf bilan yoziladi,
// oddiy funksiya esa kichik harf bilan. Shu sabab server fayli "use client"
// fayldan KICHIK harfli qiymatni import qilsa — shubhali. Bu qat'iy qoida
// emas, lekin loyihadagi nomlash uslubiga to'liq mos va noto'g'ri ogohlantirish
// bermaydi. Tip importlari (`import type`, `{ type X }`) hisobga olinmaydi:
// ular kompilyatsiyada yo'qoladi.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const SRC = "src";

/** Barcha .ts/.tsx fayllar */
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = await walk(SRC);
const text = new Map();
for (const f of files) text.set(f, await readFile(f, "utf8"));

const isClient = (f) => /^\s*(["'])use client\1/m.test(text.get(f) ?? "");

/** "@/lib/x" yoki "./x" -> haqiqiy fayl yo'li */
function resolve(spec, from) {
  let base;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.join(path.dirname(from), spec);
  else return null; // node_modules — bizni qiziqtirmaydi

  for (const cand of [`${base}.tsx`, `${base}.ts`, path.join(base, "index.tsx"), path.join(base, "index.ts")]) {
    if (text.has(cand)) return cand;
  }
  return null;
}

// import { a, b as c, type D } from "..."  /  import X from "..."
const IMPORT = /import\s+(type\s+)?([\s\S]*?)\s+from\s*["']([^"']+)["']/g;

const problems = [];

for (const file of files) {
  if (isClient(file)) continue; // server fayllarni tekshiramiz

  const src = text.get(file);
  for (const m of src.matchAll(IMPORT)) {
    const [, typeOnly, clause, spec] = m;
    if (typeOnly) continue; // `import type ...` — kompilyatsiyada yo'qoladi

    const target = resolve(spec, file);
    if (!target || !isClient(target)) continue;

    // Qavs ichidagi nomlangan importlar
    const braces = /\{([\s\S]*?)\}/.exec(clause);
    if (!braces) continue;

    for (const raw of braces[1].split(",")) {
      const part = raw.trim();
      if (!part || part.startsWith("type ")) continue; // { type X }
      const name = (part.split(/\s+as\s+/)[1] ?? part).trim();
      if (!name || !/^[a-z]/.test(name)) continue; // Bosh harf — komponent, ruxsat

      // Haqiqatan chaqirilyaptimi yoki shunchaki qayta uzatilyaptimi
      const called = new RegExp(`\\b${name}\\s*\\(`).test(src);
      const line = src.slice(0, m.index).split("\n").length;
      problems.push({ file, line, name, target, called });
    }
  }
}

if (problems.length === 0) {
  console.log(`OK — ${files.length} fayl tekshirildi, server/mijoz chegarasi buzilmagan`);
  process.exit(0);
}

console.error("\nSERVER/MIJOZ CHEGARASI BUZILGAN\n");
for (const p of problems) {
  console.error(`  ${p.file}:${p.line}`);
  console.error(`    "${p.name}" — "use client" fayldan (${p.target})${p.called ? " va CHAQIRILMOQDA" : ""}`);
}
console.error(`
Nima qilish kerak: "${problems[0].name}" kabi oddiy funksiyani neytral faylga
(masalan src/lib/) ko'chiring va ikkala tomon o'sha yerdan import qilsin.
"use client" fayldan server fayliga faqat komponent va tip chiqariladi.
`);
process.exit(1);
