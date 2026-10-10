import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import net from "node:net";
import type { InstanceModule } from "@/lib/instance";

// Markazlar reyestri — /opt/centers/registry.json (faqat deploy foydalanuvchisi o'qiydi, 600).
// Har markazning ishga tushish muhiti (env) shu yozuvdan yasaladi; manba — reyestr.
export const CENTERS_ROOT = process.env.DEV_CENTERS_ROOT || "/opt/centers";
export const APP_DIR = process.env.DEV_APP_DIR || "/opt/gl-edu";
export const BASE_DOMAIN = process.env.DEV_BASE_DOMAIN || "germaniya.live";
const REGISTRY = path.join(CENTERS_ROOT, "registry.json");
const FIRST_PORT = 3101;

export interface Center {
  slug: string;
  name: string;
  host: string;
  port: number;
  createdAt: string;
  /** Litsenziya tugash sanasi yyyy-mm-dd */
  licenseUntil: string;
  suspended: boolean;
  disabledModules: InstanceModule[];
  plan: string;
  contactName: string;
  contactPhone: string;
  notes: string;
  directorEmail: string;
  /** Markaz sessiya kaliti — har markazda alohida */
  authSecret: string;
  status: "provisioning" | "active" | "failed" | "deleted";
  lastError?: string | null;
}

export interface Registry { centers: Center[] }

export async function readRegistry(): Promise<Registry> {
  try {
    const raw = await fs.readFile(REGISTRY, "utf8");
    const r = JSON.parse(raw) as Registry;
    return { centers: Array.isArray(r.centers) ? r.centers : [] };
  } catch {
    return { centers: [] };
  }
}

/** Atomik yozish: vaqtinchalik fayl + rename (yarim yozilgan JSON qolmasin) */
export async function writeRegistry(r: Registry): Promise<void> {
  await fs.mkdir(CENTERS_ROOT, { recursive: true });
  const tmp = `${REGISTRY}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(r, null, 2), { mode: 0o600 });
  await fs.rename(tmp, REGISTRY);
}

export async function getCenter(slug: string): Promise<Center | null> {
  return (await readRegistry()).centers.find((c) => c.slug === slug) ?? null;
}

export async function updateCenter(slug: string, patch: Partial<Center>): Promise<Center | null> {
  const r = await readRegistry();
  const i = r.centers.findIndex((c) => c.slug === slug);
  if (i < 0) return null;
  r.centers[i] = { ...r.centers[i], ...patch, slug: r.centers[i].slug };
  await writeRegistry(r);
  return r.centers[i];
}

/** Port bo'shmi — serverda boshqa xizmatlar ham ishlaydi (masalan Docker konteynerlar), reyestr yetarli emas */
function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "127.0.0.1");
  });
}

/** Keyingi bo'sh port: reyestrdagi (o'chirilganlar ham) va serverda band portlar o'tkazib yuboriladi */
export async function nextPort(r: Registry): Promise<number> {
  const used = new Set(r.centers.map((c) => c.port));
  for (let p = FIRST_PORT; p < 3999; p++) {
    if (used.has(p)) continue;
    if (await portFree(p)) return p;
  }
  throw new Error("Bo'sh port topilmadi");
}

export const newSecret = (bytes = 36) => randomBytes(bytes).toString("base64url");

export const centerDir = (slug: string) => path.join(CENTERS_ROOT, slug);
export const centerDb = (slug: string) => path.join(centerDir(slug), "data", "db.sqlite");

// systemd EnvironmentFile qo'shtirnoq ichidagi teskari chiziqni o'zicha talqin qiladi — xavfli belgilar
// ekranlanmaydi, olib tashlanadi (qiymatlar: markaz nomi, fayl yo'li, base64url kalit)
const q = (v: string) => `"${String(v).replace(/[\\"$`\r\n]/g, "")}"`;

/** Markazning ishga tushish muhiti (systemd EnvironmentFile). O'zgargach xizmat qayta ishga tushiriladi. */
export function renderEnv(c: Center): string {
  const d = centerDir(c.slug);
  return [
    `# ${c.name} — Dev panel tomonidan yaratiladi; qo'lda o'zgartirmang`,
    `GL_INSTANCE=${c.slug}`,
    `ORG_NAME=${q(c.name)}`,
    `PORT=${c.port}`,
    `DATABASE_URL=${q(`file:${centerDb(c.slug)}`)}`,
    `UPLOAD_DIR=${path.join(d, "uploads")}`,
    `UPLOAD_PARTS_DIR=${path.join(d, "upload-parts")}`,
    `AUTH_SECRET=${q(c.authSecret)}`,
    `SUBSCRIPTION_UNTIL=${c.licenseUntil}`,
    `GL_SUSPENDED=${c.suspended ? "1" : "0"}`,
    `GL_DISABLED_MODULES=${c.disabledModules.join(",")}`,
    "",
  ].join("\n");
}

export async function writeCenterEnv(c: Center): Promise<void> {
  const d = centerDir(c.slug);
  await fs.mkdir(d, { recursive: true });
  const tmp = path.join(d, `env.${process.pid}.tmp`);
  await fs.writeFile(tmp, renderEnv(c), { mode: 0o600 });
  await fs.rename(tmp, path.join(d, "env"));
}
