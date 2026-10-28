import "server-only";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export const APK_DIR = path.join(process.cwd(), "apk");
export const APK_FILE = "germaniya-live.apk";
export const APK_VERSION_FILE = "germaniya-live.apk.version";

export type AppRelease = {
  available: boolean;
  href: string;
  sizeMb: number | null;
  updatedAt: Date | null;
  version: string | null;
};

export async function getAppRelease(): Promise<AppRelease> {
  const none: AppRelease = { available: false, href: "/api/app/android", sizeMb: null, updatedAt: null, version: null };
  try {
    const st = await stat(path.join(APK_DIR, APK_FILE));
    if (!st.isFile() || st.size < 1024) throw new Error("empty");

    let version: string | null = null;
    try {
      version = (await readFile(path.join(APK_DIR, APK_VERSION_FILE), "utf8")).trim().slice(0, 40) || null;
    } catch {
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
