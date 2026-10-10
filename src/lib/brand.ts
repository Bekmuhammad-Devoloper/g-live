import "server-only";
import { cache } from "react";
import { getSettings } from "./settings";

// Markaz brendi — har bir nusxada o'zi: nomi va logotiplari. Qiymatlar markaz bazasidagi
// Setting'dan (Sozlamalarda direktor o'zgartiradi), bo'lmasa ORG_NAME muhit o'zgaruvchisidan
// (Dev panel markaz yaratganda yozadi), u ham bo'lmasa — asosiy markaz qiymatlari.
export interface Brand {
  name: string;
  /** Yorug' fon uchun logotip */
  logo: string;
  /** Qorong'i fon uchun logotip */
  logoDark: string;
  /** Asosiy markazmi (Germaniya Live) — faqat unga xos narsalar (mobil ilova, landing) uchun */
  isMain: boolean;
}

export const BRAND_KEYS = { name: "brand.name", logo: "brand.logo", logoDark: "brand.logoDark" } as const;

export const getBrand = cache(async (): Promise<Brand> => {
  const isMain = !process.env.GL_INSTANCE;
  const fallbackName = process.env.ORG_NAME?.trim() || (isMain ? "Germaniya Live" : "O'quv markazi");
  let set: Record<string, string> = {};
  try { set = await getSettings([BRAND_KEYS.name, BRAND_KEYS.logo, BRAND_KEYS.logoDark]); } catch { /* baza yo'q (Dev panel) */ }
  const logo = set[BRAND_KEYS.logo] || (isMain ? "/logo.png" : "");
  return {
    name: set[BRAND_KEYS.name] || fallbackName,
    logo,
    logoDark: set[BRAND_KEYS.logoDark] || (isMain ? "/logo-dark.png" : logo),
    isMain,
  };
});
