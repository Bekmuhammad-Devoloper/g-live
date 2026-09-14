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
}
