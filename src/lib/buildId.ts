import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

let cached: string | null = null;

export function getBuildId(): string {
  if (cached) return cached;
  try {
    cached = readFileSync(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim() || "dev";
  } catch {
    cached = "dev";
  }
  return cached;
}
