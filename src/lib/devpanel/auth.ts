import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { CENTERS_ROOT } from "./registry";

// Dev panel kirishi — o'quv markazlari foydalanuvchilaridan butunlay alohida:
// login/parol muhitdan (DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD_HASH — bcrypt), alohida cookie va kalit.
const COOKIE = "gl_dev";
const secret = () => new TextEncoder().encode(process.env.DEV_SECRET || "");

export interface DevSession { email: string }

export async function getDevSession(): Promise<DevSession | null> {
  if (process.env.DEV_PANEL !== "1" || !process.env.DEV_SECRET) return null;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.email === process.env.DEV_ADMIN_EMAIL ? { email: String(payload.email) } : null;
  } catch {
    return null;
  }
}

export async function requireDev(): Promise<DevSession> {
  const s = await getDevSession();
  if (!s) redirect("/dev/login");
  return s;
}

// Email noto'g'ri bo'lsa ham bcrypt bajariladi (javob vaqti bo'yicha farqlab bo'lmasin) — shu xesh bilan
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.F1vGQ6v0dLMm0z6UhPZPzWqgZ0Gu";

// Parol tanlashga qarshi: IP bo'yicha 15 daqiqada 8 ta urinish
const attempts = new Map<string, number[]>();
async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function devLogin(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const ip = await clientIp();
  const now = Date.now();
  const list = (attempts.get(ip) ?? []).filter((t) => now - t < 15 * 60_000);
  if (list.length >= 8) return { ok: false, error: "too_many" };
  list.push(now); attempts.set(ip, list);

  const okEmail = !!process.env.DEV_ADMIN_EMAIL && email.trim().toLowerCase() === process.env.DEV_ADMIN_EMAIL.toLowerCase();
  const hash = process.env.DEV_ADMIN_PASSWORD_HASH || "";
  let okPass = false;
  try { okPass = await bcrypt.compare(password, hash || DUMMY_HASH); } catch { okPass = false; }
  if (!okEmail || !okPass || !hash) {
    await devAudit("login_failed", { email, ip });
    return { ok: false, error: "invalid" };
  }
  attempts.delete(ip);
  const token = await new SignJWT({ email: process.env.DEV_ADMIN_EMAIL })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("12h").sign(secret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/dev", maxAge: 12 * 3600 });
  await devAudit("login", { email, ip });
  return { ok: true };
}

export async function devLogout(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: "/dev" });
}

// ─── Audit jurnali: /opt/centers/dev-audit.jsonl ───
const AUDIT = path.join(CENTERS_ROOT, "dev-audit.jsonl");

export async function devAudit(action: string, data: Record<string, unknown> = {}): Promise<void> {
  try {
    await fs.mkdir(CENTERS_ROOT, { recursive: true });
    await fs.appendFile(AUDIT, JSON.stringify({ at: new Date().toISOString(), action, ...data }) + "\n", { mode: 0o600 });
  } catch { /* jurnal yozilmasa amal to'xtamasin */ }
}

export async function readDevAudit(limit = 300): Promise<{ at: string; action: string; [k: string]: unknown }[]> {
  try {
    const raw = await fs.readFile(AUDIT, "utf8");
    return raw.trim().split("\n").filter(Boolean).slice(-limit).reverse().map((l) => { try { return JSON.parse(l); } catch { return { at: "", action: "?" }; } });
  } catch {
    return [];
  }
}
