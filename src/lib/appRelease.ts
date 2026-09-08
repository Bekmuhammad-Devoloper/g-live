import "server-only";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

// Android ilovasi (APK) — build qilingan fayl repozitoriyda emas, serverda
// /opt/gl-edu/apk/ papkasida turadi. Landing shu yerdan ma'lumot oladi.

export const APK_DIR = path.join(process.cwd(), "apk");
export const APK_FILE = "germaniya-live.apk";
/**
 * Versiya yonidagi kichik fayl, masalan "2.7.0 (11)".
 *
 * APK ning o'zidan versiyani o'qish uchun ikkilik AndroidManifest ni
 * ochish kerak — og'ir va mo'rt. Shu sabab versiyani chiqarish paytida
 * scripts/publish-apk.sh aapt2 bilan o'qib, shu faylga yozadi.
 *
 * Nega kerak: sahifada faqat hajm va sana turardi. Hajm versiyalar
 * orasida deyarli o'zgarmaydi (2.0.0 — 4.2 MB, 2.7.0 — 4.3 MB), bir
 * kunda bir nechta chiqarilsa sana ham bir xil. Foydalanuvchi "saytda
 * haliyam eskisi turibdi" deb o'ylab, yangisini o'rnatmay yurdi.
 */
export const APK_VERSION_FILE = "germaniya-live.apk.version";

export type AppRelease = {
  available: boolean;
  /** Yuklab olish manzili */
  href: string;
  /** Fayl hajmi, MB */
  sizeMb: number | null;
  /** Oxirgi yangilangan sana */
  updatedAt: Date | null;
  /** "2.7.0 (11)" — chiqarish skripti yozmagan bo'lsa null */
  version: string | null;
};

export async function getAppRelease(): Promise<AppRelease> {
  const none: AppRelease = { available: false, href: "/api/app/android", sizeMb: null, updatedAt: null, version: null };
  try {
    const st = await stat(path.join(APK_DIR, APK_FILE));
    if (!st.isFile() || st.size < 1024) throw new Error("empty");

    // Versiya fayli ixtiyoriy: bo'lmasa sahifa versiyasiz chiqadi, lekin
    // hech qachon noto'g'ri raqam ko'rsatmaydi.
    let version: string | null = null;
    try {
      version = (await readFile(path.join(APK_DIR, APK_VERSION_FILE), "utf8")).trim().slice(0, 40) || null;
    } catch {
      /* fayl yo'q */
    }

    return {
      available: true,
      href: "/api/app/android",
      sizeMb: Math.round((st.size / (1024 * 1024)) * 10) / 10,
      updatedAt: st.mtime,
      version,
    };
  } catch {
    return none;
  }
}
