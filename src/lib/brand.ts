import "server-only";
import { cache } from "react";
import { getSettings } from "./settings";

export interface Brand {
  name: string;
  logo: string;
  logoDark: string;
  isMain: boolean;
}

export const BRAND_KEYS = { name: "brand.name", logo: "brand.logo", logoDark: "brand.logoDark" } as const;

export const getBrand = cache(async (): Promise<Brand> => {
  const isMain = !process.env.GL_INSTANCE;
  const fallbackName = process.env.ORG_NAME?.trim() || (isMain ? "Germaniya Live" : "O'quv markazi");
  let set: Record<string, string> = {};
  try { set = await getSettings([BRAND_KEYS.name, BRAND_KEYS.logo, BRAND_KEYS.logoDark]); } catch { }
  const logo = set[BRAND_KEYS.logo] || (isMain ? "/logo.png" : "");
  return {
    name: set[BRAND_KEYS.name] || fallbackName,
    logo,
    logoDark: set[BRAND_KEYS.logoDark] || (isMain ? "/logo-dark.png" : logo),
    isMain,
  };
});
