// Finance V2 — moliya davri qulfi (FinancePeriodLock). Yopiq oyga to'lov /
// xarajat / qaytarim yozilmaydi; reopen — FINANCE_PERIOD_REOPEN + sabab + audit.
// lockKey = `${branchId ?? "-"}:${YYYY-MM}` (SQLite NULL-unique tuzog'i uchun).

import type { FinancePeriodLock } from "@prisma/client";

import type { FinanceDb } from "../db";
import { FinanceError } from "../errors";
import { financeAudit } from "../audit";
import { yearMonthKey, type YearMonth } from "../period";

export const lockKeyFor = (branchId: string | null, ym: YearMonth) => `${branchId ?? "-"}:${yearMonthKey(ym)}`;

/** Filial yoki butun tizim uchun qulf bormi */
export async function findPeriodLock(db: FinanceDb, branchId: string | null, ym: YearMonth): Promise<FinancePeriodLock | null> {
  const keys = branchId ? [lockKeyFor(branchId, ym), lockKeyFor(null, ym)] : [lockKeyFor(null, ym)];
  const rows = await db.financePeriodLock.findMany({ where: { lockKey: { in: keys }, isLocked: true } });
  return rows[0] ?? null;
}

export async function assertPeriodOpen(db: FinanceDb, branchId: string | null, ym: YearMonth): Promise<void> {
  const lock = await findPeriodLock(db, branchId, ym);
  if (lock) throw new FinanceError("period_locked", `Moliya davri yopiq: ${yearMonthKey(ym)}`, { lockId: lock.id, reason: lock.reason });
}

export async function closePeriod(db: FinanceDb, i: { branchId: string | null; ym: YearMonth; reason: string; actorId: string }): Promise<FinancePeriodLock> {
  if (i.reason.trim().length < 3) throw new FinanceError("validation", "Sabab kamida 3 belgi");
  const lockKey = lockKeyFor(i.branchId, i.ym);
  const existing = await db.financePeriodLock.findUnique({ where: { lockKey } });
  if (existing?.isLocked) throw new FinanceError("state", "Davr allaqachon yopiq");
  const row = existing
    ? await db.financePeriodLock.update({ where: { id: existing.id }, data: { isLocked: true, lockedAt: new Date(), lockedById: i.actorId, reason: i.reason.trim(), reopenedAt: null, reopenedById: null, reopenReason: null } })
    : await db.financePeriodLock.create({ data: { branchId: i.branchId, year: i.ym.year, month: i.ym.month, lockKey, lockedById: i.actorId, reason: i.reason.trim() } });
  await financeAudit(db, { actorId: i.actorId, action: "CLOSE", entityType: "FinancePeriodLock", entityId: row.id, newValue: { branchId: i.branchId, period: yearMonthKey(i.ym) }, reason: i.reason });
  return row;
}

export async function reopenPeriod(db: FinanceDb, i: { branchId: string | null; ym: YearMonth; reason: string; actorId: string }): Promise<FinancePeriodLock> {
  if (i.reason.trim().length < 3) throw new FinanceError("validation", "Sabab kamida 3 belgi");
  const existing = await db.financePeriodLock.findUnique({ where: { lockKey: lockKeyFor(i.branchId, i.ym) } });
  if (!existing || !existing.isLocked) throw new FinanceError("state", "Davr yopiq emas");
  const row = await db.financePeriodLock.update({ where: { id: existing.id }, data: { isLocked: false, reopenedAt: new Date(), reopenedById: i.actorId, reopenReason: i.reason.trim() } });
  await financeAudit(db, { actorId: i.actorId, action: "REOPEN", entityType: "FinancePeriodLock", entityId: row.id, oldValue: { isLocked: true }, newValue: { isLocked: false }, reason: i.reason });
  return row;
}
