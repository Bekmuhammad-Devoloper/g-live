// Finance V2 ops — xavfsiz migratsiya (B3, BASELINE).
//
// Prod baza hozir `db push` rejimida (`_prisma_migrations` yo'q). Birinchi
// `migrate deploy` dan OLDIN baseline qabul qilinadi — lekin faqat prod sxemasi
// baseline bilan AYNAN mos bo'lsa (diff bo'sh). Drift bo'lsa STOP.
//
// Barcha Prisma CLI chaqiriqlari shu yerda; skriptlar va deploy shu funksiyalarni
// ishlatadi. Har funksiya berilgan baza fayliga ishlaydi — dry-run uchun NUSXA
// beriladi, real deploy uchun prod fayli.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

import { createBackup, type BackupResult } from "./backup";
import { compareSnapshots, snapshotFile, type ReconcileReport, type ReconcileSnapshot } from "./reconcile";
import { restoreRehearsal } from "./restore";
import { migrationState, openSqlite } from "./sqlite";

export class MigrateError extends Error {}

export const BASELINE_NAME = "0_baseline";

export interface PrismaCliOptions {
  repoRoot: string;
  /** bazaga ulanish (DATABASE_URL) — `file:/abs/path` */
  databaseUrl?: string;
}

/**
 * `node node_modules/prisma/build/index.js …` — npx'siz, deterministik.
 * `allowFailure`: `migrate status` kutilayotgan migratsiya bo'lsa exit 1 qaytaradi —
 * bu xato emas, ma'lumot; natija matni baribir qaytariladi.
 */
export function prismaCli(args: string[], opts: PrismaCliOptions, allowFailure = false): string {
  const bin = path.join(opts.repoRoot, "node_modules", "prisma", "build", "index.js");
  if (!existsSync(bin)) throw new MigrateError(`prisma CLI topilmadi: ${bin}`);
  try {
    return execFileSync(process.execPath, [bin, ...args], {
      cwd: opts.repoRoot,
      env: { ...process.env, ...(opts.databaseUrl ? { DATABASE_URL: opts.databaseUrl } : {}) },
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    }).toString();
  } catch (e) {
    const err = e as { stdout?: Buffer; stderr?: Buffer; message: string };
    const out = `${err.stdout?.toString() ?? ""}\n${err.stderr?.toString() ?? err.message}`;
    if (allowFailure) return out;
    throw new MigrateError(`prisma ${args.slice(0, 2).join(" ")} yiqildi:\n${out}`);
  }
}

/** `migrate diff --script` natijasi bo'shmi (faqat izoh/bo'sh qatorlar) */
export function isEmptyDiff(script: string): boolean {
  return script
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("--"))
    .length === 0;
}

const fileUrl = (p: string) => `file:${p}`;

/** Prod baza ↔ schema.prisma farqi (SQL); bo'sh = mos */
export function diffDbVsSchema(dbPath: string, opts: PrismaCliOptions): string {
  return prismaCli(
    ["migrate", "diff", "--from-url", fileUrl(dbPath), "--to-schema-datamodel", "prisma/schema.prisma", "--script"],
    { ...opts, databaseUrl: fileUrl(dbPath) },
  );
}

/** Faqat baseline qo'llangan vaqtinchalik baza yaratadi (drift tekshiruvi uchun etalon) */
export function buildBaselineDb(workDir: string, opts: PrismaCliOptions): string {
  mkdirSync(workDir, { recursive: true });
  const p = path.join(workDir, `baseline-${process.pid}-${Date.now()}.db`);
  rmSync(p, { force: true });
  prismaCli(["db", "execute", "--url", fileUrl(p), "--file", `prisma/migrations/${BASELINE_NAME}/migration.sql`], opts);
  return p;
}

export interface BaselineAdoption {
  action: "already-tracked" | "adopted";
  migrations: string[];
  driftSql: string;
}

/**
 * `_prisma_migrations` bo'lmasa: prod ↔ baseline etalon diff bo'sh bo'lsagina
 * `migrate resolve --applied 0_baseline`. Drift bo'lsa MigrateError (SQL bilan).
 */
export async function adoptBaseline(dbPath: string, workDir: string, opts: PrismaCliOptions): Promise<BaselineAdoption> {
  dbPath = path.resolve(dbPath);
  workDir = path.resolve(workDir);
  const db = openSqlite(dbPath);
  let state: Awaited<ReturnType<typeof migrationState>>;
  try {
    state = await migrationState(db);
  } finally {
    await db.$disconnect();
  }
  if (state !== null) {
    return { action: "already-tracked", migrations: state.map((m) => m.migration_name), driftSql: "" };
  }

  const etalon = buildBaselineDb(workDir, opts);
  try {
    const driftSql = prismaCli(["migrate", "diff", "--from-url", fileUrl(dbPath), "--to-url", fileUrl(etalon), "--script"], opts);
    if (!isEmptyDiff(driftSql)) {
      throw new MigrateError(`STOP: prod sxemasi baseline bilan mos emas (drift). Farq SQL:\n${driftSql}`);
    }
    prismaCli(["migrate", "resolve", "--applied", BASELINE_NAME], { ...opts, databaseUrl: fileUrl(dbPath) });
    return { action: "adopted", migrations: [BASELINE_NAME], driftSql };
  } finally {
    rmSync(etalon, { force: true });
  }
}

export interface SafeMigrateOptions extends PrismaCliOptions {
  dbPath: string;
  /** backup papkasi; `null` = backup shu yerda olinmaydi (dry-run nusxada ishlaganda) */
  backupDir: string | null;
  workDir: string;
  label?: string;
  protectBackup?: boolean;
}

export interface SafeMigrateResult {
  backup: BackupResult | null;
  baseline: BaselineAdoption;
  deployOutput: string;
  statusOutput: string;
  postDriftSql: string;
  before: ReconcileSnapshot;
  after: ReconcileSnapshot;
  reconcile: ReconcileReport;
}

/**
 * preflight → (backup) → baseline adoption → migrate status → migrate deploy →
 * post-drift (bo'sh bo'lishi shart) → reconciliation (legacy metrikalar teng).
 * Har qadam xato tashlaydi; deploy'dan keyingi xato = "backup'dan tiklang".
 */
export async function safeMigrate(o: SafeMigrateOptions): Promise<SafeMigrateResult> {
  o = { ...o, dbPath: path.resolve(o.dbPath), workDir: path.resolve(o.workDir), backupDir: o.backupDir ? path.resolve(o.backupDir) : null };
  if (!existsSync(o.dbPath)) throw new MigrateError(`baza topilmadi: ${o.dbPath}`);
  mkdirSync(o.workDir, { recursive: true });
  const before = await snapshotFile(o.dbPath);

  const backup = o.backupDir
    ? await createBackup({ sourcePath: o.dbPath, dir: o.backupDir, label: o.label, protect: o.protectBackup })
    : null;

  const baseline = await adoptBaseline(o.dbPath, o.workDir, o);
  const statusOutput = prismaCli(["migrate", "status"], { ...o, databaseUrl: fileUrl(o.dbPath) }, true);
  const deployOutput = prismaCli(["migrate", "deploy"], { ...o, databaseUrl: fileUrl(o.dbPath) });

  const postDriftSql = diffDbVsSchema(o.dbPath, o);
  if (!isEmptyDiff(postDriftSql)) {
    throw new MigrateError(`POST-CHECK FAIL: migratsiyadan keyin baza sxemaga mos emas — backup'dan tiklang (${backup?.backupPath ?? "backup yo'q"}).\n${postDriftSql}`);
  }
  const after = await snapshotFile(o.dbPath);
  const reconcile = compareSnapshots(before, after);
  if (!reconcile.ok) {
    throw new MigrateError(`RECONCILE FAIL: legacy metrikalar o'zgardi — backup'dan tiklang (${backup?.backupPath ?? "backup yo'q"}).\n${JSON.stringify(reconcile.diffs, null, 2)}`);
  }
  return { backup, baseline, deployOutput, statusOutput, postDriftSql, before, after, reconcile };
}

export interface DryRunResult extends SafeMigrateResult {
  copyPath: string;
}

/**
 * DRY-RUN: jonli bazaga TEGMAYDI. Backup olinadi → backup'dan nusxa tiklanadi →
 * migratsiya NUSXADA bajariladi → natija hisoboti. Prod uchun aynan shu oqim
 * real faylda takrorlanadi.
 */
export async function dryRunMigrate(o: Omit<SafeMigrateOptions, "backupDir"> & { backupDir: string }): Promise<DryRunResult> {
  o = { ...o, dbPath: path.resolve(o.dbPath), workDir: path.resolve(o.workDir), backupDir: path.resolve(o.backupDir) };
  const backup = await createBackup({ sourcePath: o.dbPath, dir: o.backupDir, label: o.label ?? "dry-run", protect: o.protectBackup });
  const restored = await restoreRehearsal({ backupPath: backup.backupPath, workDir: o.workDir, sourcePath: o.dbPath, keepRestored: true });
  if (restored.sourceReconcile && !restored.sourceReconcile.ok) {
    rmSync(restored.restoredPath, { force: true });
    throw new MigrateError(`restore rehearsal: tiklangan nusxa jonli baza bilan mos emas:\n${JSON.stringify(restored.sourceReconcile.diffs, null, 2)}`);
  }
  try {
    const result = await safeMigrate({ ...o, dbPath: restored.restoredPath, backupDir: null });
    return { ...result, backup, copyPath: restored.restoredPath };
  } finally {
    for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(restored.restoredPath + suffix, { force: true });
  }
}
