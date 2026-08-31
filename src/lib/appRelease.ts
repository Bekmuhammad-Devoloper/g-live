import "server-only";
import { stat } from "node:fs/promises";
import path from "node:path";

// Android ilovasi (APK) — build qilingan fayl repozitoriyda emas, serverda
// /opt/gl-edu/apk/ papkasida turadi. Landing shu yerdan ma'lumot oladi.

export const APK_DIR = path.join(process.cwd(), "apk");
export const APK_FILE = "germaniya-live.apk";

export type AppRelease = {
  available: boolean;
  /** Yuklab olish manzili */
  href: string;
  /** Fayl hajmi, MB */
  sizeMb: number | null;
  /** Oxirgi yangilangan sana */
  updatedAt: Date | null;
};

export async function getAppRelease(): Promise<AppRelease> {
  try {
    const st = await stat(path.join(APK_DIR, APK_FILE));
    if (!st.isFile() || st.size < 1024) throw new Error("empty");
    return {
      available: true,
      href: "/api/app/android",
      sizeMb: Math.round((st.size / (1024 * 1024)) * 10) / 10,
      updatedAt: st.mtime,
    };
  } catch {
    return { available: false, href: "/api/app/android", sizeMb: null, updatedAt: null };
  }
}
