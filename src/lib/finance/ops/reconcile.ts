// Finance V2 ops — reconciliation snapshot va solishtirish.
//
// Migratsiya/backfill oldidan va keyin bir xil metrikalar olinadi, farqlar
// EXPECTED / UNEXPECTED deb tasniflanadi. UNEXPECTED pul farqi = deploy FAIL.
// Metrikalar SQL bilan bevosita hisoblanadi (legacy `lib/debt.ts` ga bog'liq
// emas — u boshqa dasturchi tomonidan o'zgarib turadi); o'quvchi qarz/kredit
// legacy formula bilan (2026-09-14 holati):
//   debt   = max(0, accrued + manual − paid),  credit = max(0, paid − accrued − manual)
// bu yerda accrued hisoblanmaydi (guruh narxlari kerak) — shu sabab "manual
// (PENDING) jami" va "paid jami" alohida olinadi; per-student debt/credit
// legacy funksiya orqali `snapshotWithLegacyDebt` da qo'shiladi.

import path from "node:path";
import type { PrismaClient } from "@prisma/client";

import { openSqlite, tableExists } from "./sqlite";

export interface ReconcileSnapshot {
  takenAt: string;
  dbPath: string;
  counts: Record<string, number>;
  money: Record<string, number>;
  /** ixtiyoriy: legacy computeDebts yig'indilari */
  legacyDebt?: { debtTotal: number; creditTotal: number; students: number };
}

const COUNT_TABLES = ["Student", "Group", "GroupStudent", "Payment", "Expense", "TeacherSalary", "SalaryRule", "User", "AuditLog"] as const;

async function scalar(db: PrismaClient, sql: string): Promise<number> {
  const rows = await db.$queryRawUnsafe<Record<string, number | bigint | null>[]>(sql);
  const v = rows[0] ? Object.values(rows[0])[0] : 0;
  return Number(v ?? 0);
}

export async function takeSnapshot(db: PrismaClient, dbPath: string): Promise<ReconcileSnapshot> {
  const counts: Record<string, number> = {};
  for (const t of COUNT_TABLES) {
    counts[t] = (await tableExists(db, t)) ? await scalar(db, `SELECT count(*) FROM "${t}"`) : -1;
  }
  const money: Record<string, number> = {
    paymentPaidTotal: await scalar(db, `SELECT coalesce(sum(amount),0) FROM Payment WHERE status = 'PAID'`),
    paymentPendingTotal: await scalar(db, `SELECT coalesce(sum(amount),0) FROM Payment WHERE status = 'PENDING'`),
    paymentRefundedTotal: await scalar(db, `SELECT coalesce(sum(amount),0) FROM Payment WHERE status = 'REFUNDED'`),
    paymentCancelledTotal: await scalar(db, `SELECT coalesce(sum(amount),0) FROM Payment WHERE status = 'CANCELLED'`),
    expenseTotal: await scalar(db, `SELECT coalesce(sum(amount),0) FROM Expense`),
    teacherSalaryFiksaTotal: await scalar(db, `SELECT coalesce(sum(fiksa),0) FROM TeacherSalary`),
    teacherSalaryNetTotal: await scalar(db, `SELECT coalesce(sum(fiksa + bonus + kpi - penalty),0) FROM TeacherSalary`),
    userFiksaTotal: await scalar(db, `SELECT coalesce(sum(fiksa),0) FROM User`),
  };
  // Finance V2 jadvallari bo'lsa — ular ham (migratsiyadan keyin 0 bo'lishi shart)
  for (const t of ["FinancialTransaction", "PaymentAllocation", "TeacherEarning", "StudentCharge", "Refund", "SalaryPayout"]) {
    counts[t] = (await tableExists(db, t)) ? await scalar(db, `SELECT count(*) FROM "${t}"`) : -1;
  }
  return { takenAt: new Date().toISOString(), dbPath, counts, money };
}

export async function snapshotFile(dbPath: string): Promise<ReconcileSnapshot> {
  dbPath = path.resolve(dbPath);
  const db = openSqlite(dbPath);
  try {
    return await takeSnapshot(db, dbPath);
  } finally {
    await db.$disconnect();
  }
}

export interface ReconcileDiff {
  key: string;
  before: number;
  after: number;
  classification: "EXPECTED" | "UNEXPECTED";
  note?: string;
}

export interface ReconcileReport {
  ok: boolean;
  diffs: ReconcileDiff[];
  unexpectedMoney: number;
  unexpectedCounts: number;
}

/**
 * Ikki snapshot'ni solishtiradi. `expected` — kalit → izoh (masalan additive
 * migratsiyada yangi V2 jadvallar -1 (yo'q) dan 0 ga o'tadi — kutilgan).
 */
export function compareSnapshots(before: ReconcileSnapshot, after: ReconcileSnapshot, expected: Record<string, string> = {}): ReconcileReport {
  const diffs: ReconcileDiff[] = [];
  const check = (prefix: string, a: Record<string, number>, b: Record<string, number>) => {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const x = a[key] ?? -1;
      const y = b[key] ?? -1;
      if (x === y) continue;
      const full = `${prefix}.${key}`;
      const note = expected[full] ?? (x === -1 && y === 0 ? "yangi jadval (additive migratsiya)" : undefined);
      diffs.push({ key: full, before: x, after: y, classification: note ? "EXPECTED" : "UNEXPECTED", note });
    }
  };
  check("counts", before.counts, after.counts);
  check("money", before.money, after.money);
  if (before.legacyDebt && after.legacyDebt) {
    check("legacyDebt", before.legacyDebt as unknown as Record<string, number>, after.legacyDebt as unknown as Record<string, number>);
  }
  const unexpected = diffs.filter((d) => d.classification === "UNEXPECTED");
  const unexpectedMoney = unexpected.filter((d) => d.key.startsWith("money.") || d.key.startsWith("legacyDebt.")).length;
  return { ok: unexpected.length === 0, diffs, unexpectedMoney, unexpectedCounts: unexpected.length - unexpectedMoney };
}
