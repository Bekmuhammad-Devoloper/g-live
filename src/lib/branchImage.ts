import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";

export function branchSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[ʻʼ'’`]/g, "")
    .replace(/[^a-z0-9а-яёўқғҳ]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

export function staticBranchImage(name: string): string | null {
  const dir = path.join(process.cwd(), "public", "branches");
  const slug = branchSlug(name);
  const first = slug.split("-")[0];
  for (const s of [slug, first]) {
    if (!s) continue;
    const p = path.join(dir, `${s}.jpg`);
    if (existsSync(p)) return p;
  }
  return null;
}

export function branchHasImage(b: { name: string; imageUrl: string | null }): boolean {
  return !!b.imageUrl || !!staticBranchImage(b.name);
}
