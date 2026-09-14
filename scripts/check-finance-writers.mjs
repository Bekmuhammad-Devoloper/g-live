// Moliya jadvallariga YOZADIGAN joylar nazorati (Finance V2, Phase 0).
//
// Nega kerak: Finance V2 da pul bilan bog'liq har bir yozuv faqat
// src/lib/finance/** orqali o'tishi kerak (transaction, ledger, audit,
// idempotency bir joyda). Loyihada Payment'ga yozadigan 7 ta eski joy bor;
// dual-run davrida kimdir sezmasdan sakkizinchisini qo'shsa, ma'lumot
// ikkilanadi. Shu skript `npm run build` ichida ishlaydi va:
//
//   • src/lib/finance/** — ruxsat (V2 domeni)
//   • quyidagi LEGACY ro'yxat — ruxsat, lekin faqat ko'rsatilgan SONDA
//     (fayl ichida yangi yozuv qo'shilsa ham yiqiladi)
//   • boshqa har qanday joy — build yiqiladi
//
// Legacy ro'yxat Phase 15 (CLEANUP) da bo'shatiladi.
//
// Ishlatish: node scripts/check-finance-writers.mjs

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const SRC = path.join(ROOT, "src");
const ALLOWED_DIR = path.join(SRC, "lib", "finance") + path.sep;

// Prisma modellari (client nomi bilan). Phase 1'da V2 jadvallari qo'shiladi.
const MODELS = ["payment", "expense", "teacherSalary", "salaryRule"];
const WRITE_OPS = ["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"];

const PATTERN = new RegExp(`\\b(?:prisma|tx)\\.(${MODELS.join("|")})\\.(${WRITE_OPS.join("|")})\\(`, "g");

// Eski yozuvchi joylar: fayl → kutilgan soni (2026-09-14 holati).
const LEGACY = new Map([
  ["src/app/(app)/actions.ts", 1],
  ["src/app/(app)/finance/expenses/actions.ts", 2],
  ["src/app/(app)/finance/salary/actions.ts", 4],
  ["src/app/(app)/finance/withdrawals/actions.ts", 2],
  ["src/app/(app)/payments/actions.ts", 3],
  ["src/app/(app)/salary/actions.ts", 1],
  ["src/app/(app)/students/actions.ts", 5],
  ["src/app/(app)/teachers/salaryActions.ts", 2],
]);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(name)) {
      yield full;
    }
  }
}

const problems = [];
const seen = new Map();

for (const file of walk(SRC)) {
  if (file.startsWith(ALLOWED_DIR)) continue;

  const text = readFileSync(file, "utf8");
  const hits = [...text.matchAll(PATTERN)];
  if (hits.length === 0) continue;

  const rel = path.relative(ROOT, file);
  seen.set(rel, hits.length);

  const allowed = LEGACY.get(rel);
  if (allowed === undefined) {
    problems.push(`${rel}: ${hits.length} ta moliya yozuvi — ruxsat etilmagan joy (faqat src/lib/finance/** orqali yozing)`);
  } else if (hits.length !== allowed) {
    problems.push(`${rel}: ${hits.length} ta moliya yozuvi, kutilgan ${allowed} — legacy ro'yxatga mos emas`);
  }
}

for (const [rel, expected] of LEGACY) {
  if (!seen.has(rel)) {
    problems.push(`${rel}: legacy ro'yxatda ${expected} ta yozuv kutilgan, fayl topilmadi yoki yozuv yo'q — ro'yxatni yangilang`);
  }
}

if (problems.length > 0) {
  console.error("✗ Moliya yozuvchilari nazorati (scripts/check-finance-writers.mjs):");
  for (const p of problems) console.error("  • " + p);
  process.exit(1);
}

const total = [...seen.values()].reduce((a, b) => a + b, 0);
console.log(`✓ Moliya yozuvchilari: ${seen.size} legacy fayl, ${total} joy — ro'yxatga mos`);
