// Finance V2 ops — SQLite backup (B2).
//
// Oqim: preflight → VACUUM INTO vaqtinchalik nom → integrity → qator sonlari →
// hajm → metadata → atomik yakuniy nom → retention. Har qadam yiqilsa xato
// tashlanadi (deploy skripti migratsiyani DARHOL to'xtatadi). Yakuniy fayl
// oldindan bo'lsa ustidan yozilmaydi. `protected` backup'lar retention'da
// o'chirilmaydi (cutover arafasidagi nusxa).

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, statfsSync, writeFileSync } from "node:fs";
import path from "node:path";

import { integrityCheck, journalMode, migrationState, openSqlite, rowCounts, vacuumInto } from "./sqlite";

export class BackupError extends Error {}

/** Tekshiruvda solishtiriladigan asosiy jadvallar (bor bo'lganlari) */
export const KEY_TABLES = ["Student", "Group", "GroupStudent", "Payment", "Expense", "TeacherSalary", "SalaryRule", "AuditLog", "User", "Attendance"];

export interface BackupOptions {
  /** Manba baza fayli (absolyut yo'l) */
  sourcePath: string;
  /** Backup papkasi (yaratiladi) */
  dir: string;
  /** Fayl nomiga qo'shiladigan yorliq, masalan "deploy-8ab8fcc" */
  label?: string;
  /** Retention'da o'chirilmaydi */
  protect?: boolean;
  /** Saqlanadigan (himoyalanmagan) backup'lar soni; 0 = tozalanmaydi */
  keep?: number;
  /** Bo'sh joy talabi: manba hajmi × shu koeffitsient (default 3) */
  freeSpaceFactor?: number;
  /** Testda git bo'lmasligi mumkin */
  gitSha?: string;
  now?: Date;
}

export interface BackupMetadata {
  version: 1;
  timestamp: string;
  gitSha: string;
  label: string | null;
  protected: boolean;
  sourcePath: string;
  sourceSize: number;
  sourceJournalMode: string;
  backupPath: string;
  backupSize: number;
  integrity: "ok" | "failed";
  rowCounts: Record<string, number>;
  /** `_prisma_migrations` qatorlari yoki `null` (db push rejimi) */
  migrationState: { migration_name: string; finished_at: string | null }[] | null;
}

export interface BackupResult {
  backupPath: string;
  metadataPath: string;
  metadata: BackupMetadata;
  /** retention'da o'chirilgan fayllar */
  pruned: string[];
}

function gitShaOf(cwd: string): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "unknown";
  }
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function metadataPathFor(backupPath: string): string {
  return `${backupPath}.json`;
}

export function readBackupMetadata(backupPath: string): BackupMetadata | null {
  const p = metadataPathFor(backupPath);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as BackupMetadata;
}

export async function createBackup(opts: BackupOptions): Promise<BackupResult> {
  const now = opts.now ?? new Date();
  const keep = opts.keep ?? 10;

  // ── Preflight ── (Prisma nisbiy `file:` yo'lni prisma/ papkasiga nisbatan o'qiydi — hamma yo'l absolyut)
  opts = { ...opts, sourcePath: path.resolve(opts.sourcePath), dir: path.resolve(opts.dir) };
  if (!existsSync(opts.sourcePath)) throw new BackupError(`manba baza topilmadi: ${opts.sourcePath}`);
  const sourceSize = statSync(opts.sourcePath).size;
  if (sourceSize < 4096) throw new BackupError(`manba baza shubhali kichik (${sourceSize} bayt): ${opts.sourcePath}`);
  mkdirSync(opts.dir, { recursive: true });
  const free = statfsSync(opts.dir);
  const freeBytes = Number(free.bavail) * Number(free.bsize);
  const need = sourceSize * (opts.freeSpaceFactor ?? 3);
  if (freeBytes < need) throw new BackupError(`diskda joy yetarli emas: bo'sh ${freeBytes}, kerak ${need}`);

  const base = path.basename(opts.sourcePath);
  const gitSha = opts.gitSha ?? gitShaOf(path.dirname(opts.sourcePath));
  const label = opts.label ? `-${opts.label.replace(/[^A-Za-z0-9_.-]/g, "_")}` : "";
  const finalPath = path.join(opts.dir, `${base}.${stamp(now)}-${gitSha.slice(0, 7)}${label}.bak`);
  if (existsSync(finalPath)) throw new BackupError(`backup fayli allaqachon mavjud, ustidan yozilmaydi: ${finalPath}`);
  const tmpPath = `${finalPath}.tmp-${process.pid}`;
  rmSync(tmpPath, { force: true });

  const source = openSqlite(opts.sourcePath);
  let backup: ReturnType<typeof openSqlite> | null = null;
  try {
    const sourceJournalMode = await journalMode(source);
    const existing = Object.fromEntries(Object.entries(await rowCounts(source)).filter(([t]) => KEY_TABLES.includes(t)));
    const migState = await migrationState(source);

    // ── Nusxa (tranzaksion izchil) ──
    await vacuumInto(source, tmpPath);
    if (!existsSync(tmpPath)) throw new BackupError("VACUUM INTO fayl yaratmadi");

    // ── Tekshiruv ──
    backup = openSqlite(tmpPath);
    const integrity = await integrityCheck(backup);
    if (!integrity.ok) throw new BackupError(`backup integrity_check yiqildi: ${integrity.messages.join("; ")}`);
    const copied = await rowCounts(backup, Object.keys(existing));
    for (const [t, n] of Object.entries(existing)) {
      if (copied[t] !== n) throw new BackupError(`qator soni mos emas (${t}): manba ${n}, backup ${copied[t]}`);
    }
    const backupSize = statSync(tmpPath).size;
    if (backupSize < 4096) throw new BackupError(`backup hajmi shubhali (${backupSize} bayt)`);
    await backup.$disconnect();
    backup = null;

    // ── Metadata + atomik yakuniy nom ──
    const metadata: BackupMetadata = {
      version: 1,
      timestamp: now.toISOString(),
      gitSha,
      label: opts.label ?? null,
      protected: !!opts.protect,
      sourcePath: opts.sourcePath,
      sourceSize,
      sourceJournalMode,
      backupPath: finalPath,
      backupSize,
      integrity: "ok",
      rowCounts: copied,
      migrationState: migState?.map((m) => ({ migration_name: m.migration_name, finished_at: m.finished_at })) ?? null,
    };
    if (existsSync(finalPath)) throw new BackupError(`backup fayli paydo bo'lib qoldi, ustidan yozilmaydi: ${finalPath}`);
    renameSync(tmpPath, finalPath);
    const metadataPath = metadataPathFor(finalPath);
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    const pruned = keep > 0 ? pruneBackups(opts.dir, base, keep) : [];
    return { backupPath: finalPath, metadataPath, metadata, pruned };
  } catch (e) {
    rmSync(tmpPath, { force: true });
    throw e;
  } finally {
    await source.$disconnect();
    if (backup) await backup.$disconnect();
  }
}

/** Eng yangi `keep` ta himoyalanmagan backup qoladi; `protected` metadata'lilar hech qachon o'chirilmaydi */
export function pruneBackups(dir: string, base: string, keep: number): string[] {
  const files = readdirSync(dir)
    .filter((f) => f.startsWith(`${base}.`) && f.endsWith(".bak"))
    .map((f) => path.join(dir, f))
    .filter((p) => !(readBackupMetadata(p)?.protected ?? false))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  const victims = files.slice(keep);
  for (const p of victims) {
    rmSync(p, { force: true });
    rmSync(metadataPathFor(p), { force: true });
  }
  return victims;
}
