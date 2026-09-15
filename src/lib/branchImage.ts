import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";

// Filial surati — ochiq ariza sahifasida (oflayn → filial tanlanganda) orqa fon.
// Manba: 1) Filiallar sahifasidan yuklangan rasm (Branch.imageUrl, data URL),
//        2) bo'lmasa — loyihadagi tayyor fayl public/branches/<slug>.jpg
//           (masalan "Qibray" → qibray.jpg, "OYBEK" → oybek.jpg).
// Ikkalasi ham /api/branches/[id]/image orqali oddiy rasm sifatida beriladi.

/** "Qibray tumani" → "qibray-tumani"; lotin/kirill harflar va raqamlar qoladi */
export function branchSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[ʻʼ'’`]/g, "")
    .replace(/[^a-z0-9а-яёўқғҳ]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

/** Tayyor fayl yo'li (bo'lsa) — nomning birinchi so'zi bo'yicha ham qidiriladi ("Qibray filiali" → qibray.jpg) */
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

/** Filialda ko'rsatiladigan rasm bormi (yuklangan yoki tayyor fayl) — ariza sahifasi shunga qarab URL beradi */
export function branchHasImage(b: { name: string; imageUrl: string | null }): boolean {
  return !!b.imageUrl || !!staticBranchImage(b.name);
}
