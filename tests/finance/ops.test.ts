import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { BackupError, createBackup, pruneBackups, readBackupMetadata } from "@/lib/finance/ops/backup";
import { MigrateError, adoptBaseline, dryRunMigrate, isEmptyDiff, safeMigrate } from "@/lib/finance/ops/migrate";
import { compareSnapshots, snapshotFile } from "@/lib/finance/ops/reconcile";
import { restoreDb, restoreRehearsal, RestoreError } from "@/lib/finance/ops/restore";
import { migrationState, openSqlite } from "@/lib/finance/ops/sqlite";
import { TMP_DIR } from "../setup/paths";

// Phase 2 — migration safety, PROD'GA O'XSHASH bazada (faqat 0_baseline qo'llangan =
// hozirgi prod sxemasi, `_prisma_migrations` yo'q = db push rejimi):
//   backup → restore rehearsal → dry-run (nusxada) → real safeMigrate → idempotent qayta ishga tushirish
//   drift → STOP; backup ustidan yozilmaydi; retention protected'ga tegmaydi.

const REPO = path.resolve(__dirname, "../..");
const WORK = path.join(TMP_DIR, "ops");
const PRISMA = path.join(REPO, "node_modules", "prisma", "build", "index.js");

function legacyDb(name: string): string {
  const p = path.join(WORK, `${name}-${process.pid}.db`);
  rmSync(p, { force: true });
  execFileSync(process.execPath, [PRISMA, "db", "execute", "--url", `file:${p}`, "--file", "prisma/migrations/0_baseline/migration.sql"], { cwd: REPO, stdio: "pipe", env: { ...process.env, DATABASE_URL: `file:${p}` } });
  return p;
}

/** Legacy ma'lumot — xom SQL (yangi Prisma client eski sxemaga mos kelmaydi) */
async function seedLegacy(p: string): Promise<void> {
  const db = openSqlite(p);
  try {
    const now = new Date().toISOString();
    await db.$executeRawUnsafe(`INSERT INTO "User" (id, fullName, email, passwordHash, role, fiksa, createdAt, updatedAt) VALUES ('u1','Akmal','akmal@t.local','x','TEACHER',1500000,'${now}','${now}')`);
    await db.$executeRawUnsafe(`INSERT INTO "Student" (id, fullName, eduStatus, createdAt, updatedAt) VALUES ('s1','Ali','ACTIVE','${now}','${now}'), ('s2','Vali','ACTIVE','${now}','${now}')`);
    await db.$executeRawUnsafe(`INSERT INTO "Payment" (id, studentId, amount, method, status, isManual, createdAt, updatedAt) VALUES
      ('p1','s1',1000000,'CASH','PAID',1,'${now}','${now}'), ('p2','s1',50000,'CASH','PENDING',1,'${now}','${now}'),
      ('p3','s2',300000,'CLICK','PAID',0,'${now}','${now}'), ('p4','s2',200000,'CASH','REFUNDED',1,'${now}','${now}')`);
    await db.$executeRawUnsafe(`INSERT INTO "TeacherSalary" (id, teacherId, year, month, fiksa, bonus, penalty, kpi, closed, createdAt, updatedAt) VALUES ('ts1','u1',2026,8,1500000,100000,0,50000,1,'${now}','${now}')`);
    await db.$executeRawUnsafe(`INSERT INTO "Expense" (id, name, date, amount, method, createdAt, updatedAt) VALUES ('e1','Ijara','${now}',3000000,'CASH','${now}','${now}')`);
    await db.$executeRawUnsafe(`INSERT INTO "SalaryRule" (id, scope, amountType, amount, isDefault, createdAt) VALUES ('r1','ALL','PERCENT',40,1,'${now}')`);
  } finally {
    await db.$disconnect();
  }
}

describe("finance v2 ops — backup / restore / migrate", () => {
  let src: string;
  const backupDir = path.join(WORK, "backups");

  beforeAll(async () => {
    mkdirSync(WORK, { recursive: true });
    rmSync(backupDir, { recursive: true, force: true });
    src = legacyDb("legacy");
    await seedLegacy(src);
  }, 60_000);

  afterAll(() => {
    rmSync(WORK, { recursive: true, force: true });
  });

  it("backup: VACUUM INTO, integrity, qator sonlari, metadata; ustidan yozilmaydi", async () => {
    const now = new Date(2026, 8, 15, 1, 2, 3);
    const r = await createBackup({ sourcePath: src, dir: backupDir, label: "test", gitSha: "abcdef0123", now, keep: 0 });
    expect(existsSync(r.backupPath)).toBe(true);
    expect(r.metadata.integrity).toBe("ok");
    expect(r.metadata.rowCounts.Payment).toBe(4);
    expect(r.metadata.rowCounts.Student).toBe(2);
    expect(r.metadata.migrationState).toBeNull(); // db push rejimi
    expect(r.metadata.sourceJournalMode).toBe("delete");
    expect(readBackupMetadata(r.backupPath)?.gitSha).toBe("abcdef0123");
    expect(r.backupPath.endsWith(".20260915-010203-abcdef0-test.bak")).toBe(true);
    // Xuddi shu nom bilan qayta — ustidan yozilmaydi
    await expect(createBackup({ sourcePath: src, dir: backupDir, label: "test", gitSha: "abcdef0123", now, keep: 0 })).rejects.toThrow(BackupError);
    // Manba yo'q — xato
    await expect(createBackup({ sourcePath: path.join(WORK, "yo-q.db"), dir: backupDir, keep: 0 })).rejects.toThrow(BackupError);
  }, 30_000);

  it("retention: eng yangi N qoladi, protected o'chirilmaydi", async () => {
    const base = path.basename(src);
    const dir = path.join(WORK, "ret");
    rmSync(dir, { recursive: true, force: true });
    const mk = (i: number, protect = false) => createBackup({ sourcePath: src, dir, gitSha: "0000000", now: new Date(2026, 0, i, 0, 0, 0), keep: 0, protect, label: `n${i}` });
    const b1 = await mk(1, true);
    const b2 = await mk(2);
    const b3 = await mk(3);
    const b4 = await mk(4);
    // mtime bo'yicha tartib — hozir yaratilgan; eng yangi 2 ta himoyalanmagan qoladi
    const pruned = pruneBackups(dir, base, 2);
    expect(pruned.map((p) => path.basename(p))).toEqual([path.basename(b2.backupPath)]);
    expect(existsSync(b1.backupPath)).toBe(true); // protected
    expect(existsSync(b3.backupPath) && existsSync(b4.backupPath)).toBe(true);
    expect(readdirSync(dir).filter((f) => f.endsWith(".bak")).length).toBe(3);
  }, 30_000);

  it("restore rehearsal: nusxa tiklanadi, integrity, sonlar va pul manba bilan teng", async () => {
    const b = await createBackup({ sourcePath: src, dir: backupDir, label: "rehearsal", gitSha: "1111111", keep: 0 });
    const r = await restoreRehearsal({ backupPath: b.backupPath, workDir: path.join(WORK, "restore"), sourcePath: src });
    expect(r.integrity).toBe("ok");
    expect(r.metadataMismatches).toEqual([]);
    expect(r.sourceReconcile?.ok).toBe(true);
    expect(r.restoredSnapshot.money.paymentPaidTotal).toBe(1_300_000);
    expect(r.restoredSnapshot.money.paymentPendingTotal).toBe(50_000);
    expect(r.restoredSnapshot.money.paymentRefundedTotal).toBe(200_000);
    expect(r.restoredSnapshot.money.teacherSalaryNetTotal).toBe(1_650_000);
    expect(existsSync(r.restoredPath)).toBe(false); // tozalandi
  }, 30_000);

  it("dry-run: migratsiya NUSXADA — manba o'zgarmaydi; baseline qabul, core qo'llanadi, drift bo'sh, reconcile ok", async () => {
    const r = await dryRunMigrate({ dbPath: src, backupDir, workDir: path.join(WORK, "dry"), repoRoot: REPO, label: "dry" });
    expect(r.baseline.action).toBe("adopted");
    expect(r.deployOutput).toMatch(/finance_v2_core/);
    expect(isEmptyDiff(r.postDriftSql)).toBe(true);
    expect(r.reconcile.ok).toBe(true);
    expect(r.reconcile.diffs.every((d) => d.classification === "EXPECTED")).toBe(true);
    expect(r.after.counts.TeacherEarning).toBe(0);
    expect(r.after.money.paymentPaidTotal).toBe(r.before.money.paymentPaidTotal);
    // manba hali db push rejimida
    const db = openSqlite(src);
    try {
      expect(await migrationState(db)).toBeNull();
    } finally {
      await db.$disconnect();
    }
  }, 90_000);

  it("drift: baseline'ga mos bo'lmagan baza → STOP (resolve qilinmaydi)", async () => {
    const drifted = legacyDb("drifted");
    const db = openSqlite(drifted);
    try {
      await db.$executeRawUnsafe(`ALTER TABLE "Payment" ADD COLUMN "extra" TEXT`);
    } finally {
      await db.$disconnect();
    }
    await expect(adoptBaseline(drifted, path.join(WORK, "drift"), { repoRoot: REPO })).rejects.toThrow(/STOP/);
    const db2 = openSqlite(drifted);
    try {
      expect(await migrationState(db2)).toBeNull();
    } finally {
      await db2.$disconnect();
    }
  }, 60_000);

  it("real safeMigrate: backup + baseline + deploy + post-check + reconcile; qayta ishga tushirish idempotent", async () => {
    const before = await snapshotFile(src);
    const r = await safeMigrate({ dbPath: src, backupDir, workDir: path.join(WORK, "real"), repoRoot: REPO, label: "real", protectBackup: true });
    expect(r.backup?.metadata.protected).toBe(true);
    expect(r.baseline.action).toBe("adopted");
    expect(r.reconcile.ok).toBe(true);
    const after = await snapshotFile(src);
    expect(compareSnapshots(before, after).ok).toBe(true);
    expect(after.counts.StudentCharge).toBe(0);

    // Legacy ma'lumot o'z joyida, yangi ustunlar null/default
    const db = openSqlite(src);
    try {
      expect((await migrationState(db))?.map((m) => m.migration_name)).toEqual(["0_baseline", "20260915000000_finance_v2_core"]);
      const rows = await db.$queryRawUnsafe<{ id: string; amount: number; receivedAt: string | null; legacyRole: string | null }[]>(`SELECT id, amount, receivedAt, legacyRole FROM Payment ORDER BY id`);
      expect(rows.map((x) => [x.id, x.amount, x.receivedAt, x.legacyRole])).toEqual([["p1", 1_000_000, null, null], ["p2", 50_000, null, null], ["p3", 300_000, null, null], ["p4", 200_000, null, null]]);
      const exp = await db.$queryRawUnsafe<{ status: string }[]>(`SELECT status FROM Expense`);
      expect(exp[0].status).toBe("ACTIVE");
    } finally {
      await db.$disconnect();
    }

    // Ikkinchi marta — already-tracked, hech narsa o'zgarmaydi
    const r2 = await safeMigrate({ dbPath: src, backupDir, workDir: path.join(WORK, "real2"), repoRoot: REPO, label: "again" });
    expect(r2.baseline.action).toBe("already-tracked");
    expect(r2.reconcile.ok).toBe(true);
    expect(r2.deployOutput).toMatch(/No pending migrations/);
  }, 120_000);

  it("REAL tiklash: migratsiyalangan baza backup'dan avvalgi holatga qaytadi (ilova to'xtatilgan)", async () => {
    // src hozir migratsiyalangan (_prisma_migrations bor); 'rehearsal' backup'i migratsiyadan OLDIN olingan
    const before = readdirSync(backupDir).filter((f) => f.includes("-rehearsal") && f.endsWith(".bak"))[0];
    expect(before).toBeTruthy();
    await expect(restoreDb({ backupPath: path.join(backupDir, before), dbPath: src, appStopped: false })).rejects.toThrow(RestoreError);
    const r = await restoreDb({ backupPath: path.join(backupDir, before), dbPath: src, appStopped: true });
    expect(existsSync(r.brokenSavedAs)).toBe(true);
    const db = openSqlite(src);
    try {
      expect(await migrationState(db)).toBeNull(); // yana db push rejimi = backup holati
      const n = await db.$queryRawUnsafe<{ n: number | bigint }[]>("SELECT count(*) AS n FROM Payment");
      expect(Number(n[0].n)).toBe(4);
    } finally {
      await db.$disconnect();
    }
  }, 30_000);

  it("MigrateError turi va isEmptyDiff", () => {
    expect(isEmptyDiff("-- This is an empty migration.\n")).toBe(true);
    expect(isEmptyDiff("-- x\nALTER TABLE a ADD COLUMN b TEXT;")).toBe(false);
    expect(new MigrateError("x")).toBeInstanceOf(Error);
    expect(statSync(src).size).toBeGreaterThan(4096);
  });
});
