import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const SRC = "src";

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

function resolve(spec, from) {
  let base;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.join(path.dirname(from), spec);
  else return null;

  for (const cand of [`${base}.tsx`, `${base}.ts`, path.join(base, "index.tsx"), path.join(base, "index.ts")]) {
    if (text.has(cand)) return cand;
  }
  return null;
}

const IMPORT = /import\s+(type\s+)?([\s\S]*?)\s+from\s*["']([^"']+)["']/g;

const problems = [];

for (const file of files) {
  if (isClient(file)) continue;

  const src = text.get(file);
  for (const m of src.matchAll(IMPORT)) {
    const [, typeOnly, clause, spec] = m;
    if (typeOnly) continue;

    const target = resolve(spec, file);
    if (!target || !isClient(target)) continue;

    const braces = /\{([\s\S]*?)\}/.exec(clause);
    if (!braces) continue;

    for (const raw of braces[1].split(",")) {
      const part = raw.trim();
      if (!part || part.startsWith("type ")) continue;
      const name = (part.split(/\s+as\s+/)[1] ?? part).trim();
      if (!name || !/^[a-z]/.test(name)) continue;

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
