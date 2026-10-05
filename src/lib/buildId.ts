import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

// Joriy build identifikatori (.next/BUILD_ID). Mijoz uni /api/version bilan solishtirib,
// yangi deploy'dan keyin ochiq qolgan sahifani yangilaydi — aks holda eski sahifadagi
// server action'lar "Failed to find Server Action" bilan yiqiladi va tugmalar "ishlamay" qoladi.

let cached: string | null = null;

export function getBuildId(): string {
  if (cached) return cached;
  try {
    cached = readFileSync(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim() || "dev";
  } catch {
    cached = "dev"; // dev rejimida fayl yo'q
  }
  return cached;
}
