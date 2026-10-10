import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { APP_DIR, CENTERS_ROOT, centerDb, centerDir, type Center } from "./registry";

const run = promisify(execFile);
const GL = "/usr/local/sbin/gl-center";

export interface Step { step: string; ok: boolean; detail?: string }

async function sh(file: string, args: string[], opts: { env?: Record<string, string>; cwd?: string; timeout?: number } = {}) {
  const r = await run(file, args, {
    cwd: opts.cwd ?? APP_DIR,
    env: { ...process.env, ...(opts.env ?? {}) },
    timeout: opts.timeout ?? 120_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  return { out: String(r.stdout ?? ""), err: String(r.stderr ?? "") };
}
const errText = (e: unknown) => {
  const x = e as { stderr?: string; stdout?: string; message?: string };
  return String(x?.stderr || x?.stdout || x?.message || e).trim().split("\n").slice(-4).join(" ").slice(0, 400);
};

/** Root amali — faqat gl-center skripti orqali (buyruq va argumentlar unda tekshiriladi) */
export async function glCenter(...args: string[]): Promise<{ ok: boolean; out: string }> {
  try {
    const r = await sh("sudo", ["-n", GL, ...args], { timeout: 180_000 });
    return { ok: true, out: (r.out + r.err).trim() };
  } catch (e) {
    return { ok: false, out: errText(e) };
  }
}

/** Markaz bazasi sxemasini joriy kodga moslash (yangi markazda — yaratish) */
export async function pushSchema(slug: string): Promise<Step> {
  try {
    await sh("npx", ["prisma", "db", "push", "--skip-generate"], { env: { DATABASE_URL: `file:${centerDb(slug)}` }, timeout: 180_000 });
    return { step: "Baza sxemasi", ok: true };
  } catch (e) {
    return { step: "Baza sxemasi", ok: false, detail: errText(e) };
  }
}

export async function initCenterDb(c: Center, director: { name: string; email: string; password: string; phone: string }): Promise<Step> {
  try {
    const r = await sh("node", ["scripts/center-init.mjs"], {
      env: {
        DATABASE_URL: `file:${centerDb(c.slug)}`,
        CENTER_NAME: c.name, DIRECTOR_NAME: director.name, DIRECTOR_EMAIL: director.email,
        DIRECTOR_PASSWORD: director.password, DIRECTOR_PHONE: director.phone,
        TEMPLATE_DB: path.join(APP_DIR, "prisma", "dev.db"),
      },
    });
    const last = r.out.trim().split("\n").pop() ?? "";
    const ok = last.includes('"ok":true');
    return { step: "Direktor va filial", ok, detail: ok ? undefined : (r.err || last).slice(0, 300) };
  } catch (e) {
    return { step: "Direktor va filial", ok: false, detail: errText(e) };
  }
}

export async function prepareDirs(slug: string): Promise<void> {
  const d = centerDir(slug);
  for (const sub of ["data", "uploads", "upload-parts", "backups"]) await fs.mkdir(path.join(d, sub), { recursive: true });
}

/** Markaz javob beryaptimi (/api/version) */
export async function health(port: number, timeoutMs = 3000): Promise<boolean> {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/version`, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

export async function waitHealthy(port: number, totalMs = 60_000): Promise<boolean> {
  const until = Date.now() + totalMs;
  while (Date.now() < until) {
    if (await health(port)) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

// ─── Statistika (markaz bazasidan faqat o'qish, sqlite3 CLI) ───
export interface CenterStats {
  students: number; activeStudents: number; staff: number; groups: number; leads: number;
  paidThisMonth: number; dbBytes: number; uploadsBytes: number; lastLoginAt: string | null;
}

async function sqlite(dbFile: string, sql: string): Promise<string[]> {
  const r = await sh("sqlite3", ["-readonly", "-separator", "|", dbFile, sql], { timeout: 15_000 });
  return r.out.trim().split("\n");
}

async function dirBytes(dir: string): Promise<number> {
  try {
    const r = await sh("du", ["-sb", dir], { timeout: 20_000 });
    return Number(r.out.split(/\s+/)[0]) || 0;
  } catch { return 0; }
}

export async function centerStats(dbFile: string, uploadsDir: string): Promise<CenterStats | null> {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const [row] = await sqlite(dbFile, `SELECT
      (SELECT count(*) FROM Student),
      (SELECT count(*) FROM Student WHERE eduStatus='ACTIVE'),
      (SELECT count(*) FROM User WHERE isActive=1 AND role NOT IN ('STUDENT','PARENT')),
      (SELECT count(*) FROM "Group" WHERE status='ACTIVE'),
      (SELECT count(*) FROM Lead),
      (SELECT coalesce(sum(amount),0) FROM Payment WHERE status='PAID' AND createdAt >= ${monthStart}),
      (SELECT max(lastLoginAt) FROM User)`);
    const v = row.split("|");
    const st = await fs.stat(dbFile).catch(() => null);
    const last = Number(v[6]);
    return {
      students: +v[0] || 0, activeStudents: +v[1] || 0, staff: +v[2] || 0, groups: +v[3] || 0, leads: +v[4] || 0,
      paidThisMonth: +v[5] || 0, dbBytes: st?.size ?? 0, uploadsBytes: await dirBytes(uploadsDir),
      lastLoginAt: Number.isFinite(last) && last > 0 ? new Date(last).toISOString() : null,
    };
  } catch {
    return null;
  }
}

/** Direktor (yoki istalgan xodim) parolini yangilash — markaz bazasiga to'g'ridan-to'g'ri (sqlite3) */
export async function resetUserPassword(dbFile: string, email: string, password: string): Promise<boolean> {
  const hash = await bcrypt.hash(password, 10);
  const esc = (s: string) => s.replace(/'/g, "''");
  try {
    await sh("sqlite3", [dbFile, `UPDATE User SET passwordHash='${esc(hash)}', plainPassword='${esc(password)}', isActive=1 WHERE lower(email)=lower('${esc(email)}'); SELECT changes();`], { timeout: 15_000 });
    const [n] = await sqlite(dbFile, `SELECT count(*) FROM User WHERE lower(email)=lower('${esc(email)}')`);
    return Number(n) > 0;
  } catch {
    return false;
  }
}

/** Markaz brendi nomini bazada ham yangilash (Sozlamalar > Markaz brendi bilan bir xil kalit) */
export async function setBrandName(dbFile: string, name: string): Promise<void> {
  const esc = name.replace(/'/g, "''");
  await sh("sqlite3", [dbFile, `INSERT INTO Setting(key,value,updatedAt) VALUES('brand.name','${esc}',${Date.now()}) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt;`], { timeout: 15_000 });
}

export async function listBackups(slug: string): Promise<{ name: string; bytes: number; at: string }[]> {
  const d = path.join(centerDir(slug), "backups");
  try {
    const names = (await fs.readdir(d)).filter((n) => /^db-\d{8}-\d{6}\.sqlite$/.test(n)).sort().reverse();
    return Promise.all(names.map(async (n) => { const st = await fs.stat(path.join(d, n)); return { name: n, bytes: st.size, at: st.mtime.toISOString() }; }));
  } catch {
    return [];
  }
}

export async function serverStats(): Promise<Record<string, string>> {
  const r = await glCenter("stats");
  const out: Record<string, string> = {};
  for (const line of r.out.split("\n")) { const i = line.indexOf("="); if (i > 0) out[line.slice(0, i)] = line.slice(i + 1); }
  return out;
}

export async function appVersion(): Promise<string> {
  try { return (await sh("git", ["log", "-1", "--format=%h · %cd · %s", "--date=format:%d.%m.%Y %H:%M"], { timeout: 10_000 })).out.trim(); } catch { return "—"; }
}

export { CENTERS_ROOT };
