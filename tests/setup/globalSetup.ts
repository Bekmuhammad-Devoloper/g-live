import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

import { TEMPLATE_DB, TMP_DIR } from "./paths";

// Vitest globalSetup: Prisma sxemasini BITTA shablon SQLite bazaga yozadi.
// Har test fayli shu shablonning nusxasi bilan ishlaydi (prismaTestDb.ts) —
// shunda `prisma db push` har testda emas, bir marta bajariladi.
//
// Faqat tests/.tmp ichida ishlaydi — loyihaning dev.db yoki prod bazasiga
// hech qachon tegmaydi.
export default function setup(): void {
  rmSync(TMP_DIR, { recursive: true, force: true });
  mkdirSync(TMP_DIR, { recursive: true });

  execFileSync("npx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], {
    cwd: path.resolve(__dirname, "../.."),
    env: { ...process.env, DATABASE_URL: `file:${TEMPLATE_DB}` },
    stdio: "pipe",
  });
  // Testlar uchun cutover = 2026-08-01 00:00 Tashkent (prod standarti 2026-10-01): avgust+ xizmat oylari V2.
  // Cutover qo'riqchisi (PRE_CUTOVER_PAYMENT / LEGACY_SERVICE_MONTH) alohida testda sozlama o'zgartirib tekshiriladi.
  execFileSync("node", ["-e", `
    const { PrismaClient } = require("@prisma/client");
    const p = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
    p.setting.upsert({ where: { key: "finance.v2.cutoverAt" }, update: { value: "2026-08-01T00:00:00+05:00" }, create: { key: "finance.v2.cutoverAt", value: "2026-08-01T00:00:00+05:00" } }).finally(() => p.$disconnect());
  `], { cwd: path.resolve(__dirname, "../.."), env: { ...process.env, DATABASE_URL: `file:${TEMPLATE_DB}` }, stdio: "pipe" });
}
