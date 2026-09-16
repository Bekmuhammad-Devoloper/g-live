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

// Prisma modellari (client nomi bilan): legacy moliya + Finance V2 jadvallari.
const MODELS = [
  "payment", "expense", "teacherSalary", "salaryRule",
  // Finance V2 (Phase 1) — faqat src/lib/finance/** yozadi
  "financialAccount", "financialTransaction", "transfer", "billingPolicy", "studentCharge", "studentDiscount",
  "paymentAllocation", "refund", "groupTeacherAssignment", "studentStatusHistory", "salaryPolicy",
  "teacherEarning", "salaryPeriod", "salaryPayout", "financePeriodLock", "groupStudentHistory",
];
const WRITE_OPS = ["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"];

const PATTERN = new RegExp(`\\b(?:prisma|tx)\\.(${MODELS.join("|")})\\.(${WRITE_OPS.join("|")})\\(`, "g");
// User.fiksa / User.kpiBonus — eski maosh manbai (V2'da SalaryRule). `user.update/upsert(...)`
// chaqiruvi argumentida shu maydonlar bo'lsa — yozuv deb hisoblanadi.
const USER_WRITE_CALL = /\b(?:prisma|tx)\.user\.(?:update|updateMany|upsert)\(/g;
const USER_SALARY_FIELDS = /\b(fiksa|kpiBonus)\b/;

// Eski yozuvchi joylar: fayl → kutilgan soni (2026-09-14 holati).
// User.fiksa/kpiBonus yozuvchilari alohida (USER_SALARY_LEGACY).
const LEGACY = new Map([
  ["src/app/(app)/actions.ts", 1],
  ["src/app/(app)/branches/actions.ts", 2], // forceDeleteBranch: payment.deleteMany (V2 tarixi bo'lsa bloklanadi); assignUnassignedToBranch: expense.updateMany faqat postedAt=null
  ["src/app/(app)/finance/expenses/actions.ts", 2],
  ["src/app/(app)/finance/salary/actions.ts", 4],
  ["src/app/(app)/finance/withdrawals/actions.ts", 2],
  ["src/app/(app)/payments/actions.ts", 3],
  ["src/app/(app)/salary/actions.ts", 1],
  ["src/app/(app)/students/actions.ts", 5],
  ["src/app/(app)/teachers/salaryActions.ts", 2],
]);

// User.fiksa / kpiBonus ga yozadigan eski joylar: fayl → soni (2026-09-15 holati)
const USER_SALARY_LEGACY = new Map([
  ["src/app/(app)/users/actions.ts", 1], // xodim fiksa (user.update; create detektorga kirmaydi) — TEACHER uchun V2 yoqilganda yozilmaydi (legacyFiksaWritable)
  ["src/app/(app)/teachers/salaryActions.ts", 2],
  ["src/app/(app)/reports/operators/actions.ts", 1],
  ["src/app/(app)/reports/kpi/actions.ts", 1],
]);

/** Chaqiruv argumenti: ochilgan qavsdan mos yopilgan qavsgacha (satrlar ichidagi qavslar e'tiborsiz — yetarli) */
function callArgument(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return text.slice(openIndex, i + 1);
    }
  }
  return text.slice(openIndex);
}

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

// ── User.fiksa / kpiBonus yozuvlari ──
const salarySeen = new Map();
for (const file of walk(SRC)) {
  if (file.startsWith(ALLOWED_DIR)) continue;
  const text = readFileSync(file, "utf8");
  const writes = [...text.matchAll(USER_WRITE_CALL)].filter((m) => USER_SALARY_FIELDS.test(callArgument(text, m.index + m[0].length - 1)));
  if (writes.length === 0) continue;
  const rel = path.relative(ROOT, file);
  salarySeen.set(rel, writes.length);
  const allowed = USER_SALARY_LEGACY.get(rel);
  if (allowed === undefined) {
    problems.push(`${rel}: User.fiksa/kpiBonus ga ${writes.length} ta yozuv — ruxsat etilmagan (V2'da SalaryRule orqali)`);
  } else if (writes.length !== allowed) {
    problems.push(`${rel}: User.fiksa/kpiBonus ${writes.length} ta yozuv, kutilgan ${allowed}`);
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
