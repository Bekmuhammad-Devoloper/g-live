import "server-only";
import { getSettings, setSetting } from "./settings";

// Kurs (daraja) bannerlari — o'quvchi ilovasidagi "Kurslar" ro'yxatida
// A1/A2/... kartochkasi o'rniga ko'rinadigan rasm. Ma'muriyat Sozlamalar >
// O'quvchi portali bo'limidan yuklaydi; rasm qo'yilmagan darajada avvalgi
// gradient kartochka qoladi.

export const BANNER_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type BannerLevel = (typeof BANNER_LEVELS)[number];

const key = (code: string) => `portal.levelBanner.${code}`;

// Faqat o'z serverimizga yuklangan rasm (tashqi manzil qo'yib bo'lmaydi)
export const isSafeBanner = (u: string) => /^\/uploads\/[\w.-]+$/.test(u);

export async function getLevelBanners(): Promise<Record<string, string | null>> {
  const rows = await getSettings(BANNER_LEVELS.map(key));
  const out: Record<string, string | null> = {};
  for (const code of BANNER_LEVELS) {
    const v = rows[key(code)];
    out[code] = v && isSafeBanner(v) ? v : null;
  }
  return out;
}

export async function setLevelBanner(code: string, url: string | null): Promise<void> {
  await setSetting(key(code), url ?? "");
}
