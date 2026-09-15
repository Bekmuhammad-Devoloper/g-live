// Finance V2 ops — restore rehearsal (B2).
//
// Backup fayli borligi emas, undan tizimni TIKLASH mumkinligi isbotlanadi:
// nusxa → yangi vaqtinchalik yo'l → Prisma ulanadi → integrity → qator sonlari
// → pul yig'indilari manba (yoki metadata) bilan solishtiriladi.

import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

import { readBackupMetadata } from "./backup";
import { compareSnapshots, takeSnapshot, type ReconcileReport, type ReconcileSnapshot } from "./reconcile";
import { integrityCheck, openSqlite, rowCounts } from "./sqlite";

export class RestoreError extends Error {}

export interface RestoreRehearsalOptions {
  backupPath: string;
  /** Tiklash uchun vaqtinchalik papka (yaratiladi); tugagach fayl o'chiriladi (keepRestored=false) */
  workDir: string;
  /** Solishtirish uchun jonli manba (ixtiyoriy — bo'lmasa metadata bilan solishtiriladi) */
  sourcePath?: string;
  keepRestored?: boolean;
}

export interface RestoreRehearsalResult {
  restoredPath: string;
  restoredSize: number;
  integrity: "ok";
  rowCounts: Record<string, number>;
  /** metadata'dagi qator sonlari bilan farq (bo'lsa) */
  metadataMismatches: { table: string; metadata: number; restored: number }[];
  /** jonli manba bilan reconciliation (sourcePath berilgan bo'lsa) */
  sourceReconcile?: ReconcileReport;
  restoredSnapshot: ReconcileSnapshot;
}

export async function restoreRehearsal(opts: RestoreRehearsalOptions): Promise<RestoreRehearsalResult> {
  opts = { ...opts, backupPath: path.resolve(opts.backupPath), workDir: path.resolve(opts.workDir), sourcePath: opts.sourcePath ? path.resolve(opts.sourcePath) : undefined };
  if (!existsSync(opts.backupPath)) throw new RestoreError(`backup topilmadi: ${opts.backupPath}`);
  mkdirSync(opts.workDir, { recursive: true });
  const restoredPath = path.join(opts.workDir, `restored-${process.pid}-${Date.now()}.db`);
  if (existsSync(restoredPath)) throw new RestoreError(`tiklash yo'li band: ${restoredPath}`);

  // 1. nusxa (backup fayliga tegilmaydi)
  copyFileSync(opts.backupPath, restoredPath);
  const restoredSize = statSync(restoredPath).size;

  const db = openSqlite(restoredPath);
  try {
    // 2–3. Prisma ulanadi, integrity
    const integrity = await integrityCheck(db);
    if (!integrity.ok) throw new RestoreError(`tiklangan baza integrity_check yiqildi: ${integrity.messages.join("; ")}`);

    // 4. qator sonlari — metadata bilan
    const meta = readBackupMetadata(opts.backupPath);
    const counts = await rowCounts(db, meta ? Object.keys(meta.rowCounts) : undefined);
    const metadataMismatches: RestoreRehearsalResult["metadataMismatches"] = [];
    if (meta) {
      for (const [t, n] of Object.entries(meta.rowCounts)) {
        if (counts[t] !== n) metadataMismatches.push({ table: t, metadata: n, restored: counts[t] ?? -1 });
      }
      if (metadataMismatches.length) throw new RestoreError(`tiklangan baza metadata bilan mos emas: ${JSON.stringify(metadataMismatches)}`);
    }

    // 5–7. pul yig'indilari, maosh, o'quvchilar — jonli manba bilan (bo'lsa)
    const restoredSnapshot = await takeSnapshot(db, restoredPath);
    let sourceReconcile: ReconcileReport | undefined;
    if (opts.sourcePath) {
      const src = openSqlite(opts.sourcePath);
      try {
        const sourceSnapshot = await takeSnapshot(src, opts.sourcePath);
        sourceReconcile = compareSnapshots(sourceSnapshot, restoredSnapshot);
      } finally {
        await src.$disconnect();
      }
    }

    return { restoredPath, restoredSize, integrity: "ok", rowCounts: counts, metadataMismatches, sourceReconcile, restoredSnapshot };
  } finally {
    await db.$disconnect();
    if (!opts.keepRestored) {
      for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(restoredPath + suffix, { force: true });
    }
  }
}
