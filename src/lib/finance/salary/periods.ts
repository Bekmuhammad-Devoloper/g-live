// Finance V2 — SalaryPeriod (maosh davri). Bu fayl Phase 6 uchun minimal
// (ensure/settlement), Phase 8 da recalc/approve/close/reopen/payout qo'shiladi.
//
// Settlement qoidasi (RULE 5, S7): earning o'z oyining davri OPEN/CALCULATED
// bo'lsa o'sha davrga; APPROVED/PARTIALLY_PAID/PAID/CLOSED bo'lsa KEYINGI OCHIQ
// davrga tushadi (tarixiy earningMonth o'zgarmaydi, yopiq davr summasi mutate emas).

import type { SalaryPeriod } from "@prisma/client";

import { SALARY_PERIOD_SETTLED_STATUSES, type SalaryPeriodStatus } from "../constants";
import type { FinanceDb } from "../db";
import { isUniqueViolation } from "../db";
import { nextMonth, type YearMonth } from "../period";

export function isSettledStatus(status: string): boolean {
  return (SALARY_PERIOD_SETTLED_STATUSES as readonly string[]).includes(status as SalaryPeriodStatus);
}

/** (teacher, yil, oy) davri — bo'lmasa OPEN yaratiladi (idempotent) */
export async function ensureSalaryPeriod(db: FinanceDb, teacherId: string, ym: YearMonth): Promise<SalaryPeriod> {
  const existing = await db.salaryPeriod.findUnique({ where: { teacherId_year_month: { teacherId, year: ym.year, month: ym.month } } });
  if (existing) return existing;
  try {
    return await db.salaryPeriod.create({ data: { teacherId, year: ym.year, month: ym.month, status: "OPEN" } });
  } catch (e) {
    if (isUniqueViolation(e)) return db.salaryPeriod.findUniqueOrThrow({ where: { teacherId_year_month: { teacherId, year: ym.year, month: ym.month } } });
    throw e;
  }
}

/** Earning uchun settlement davri: o'z oyi ochiq bo'lsa o'zi, aks holda keyingi ochiq (yaratiladi) */
export async function settlementPeriodFor(db: FinanceDb, teacherId: string, earningMonth: YearMonth, maxHops = 36): Promise<SalaryPeriod> {
  let ym = earningMonth;
  for (let i = 0; i < maxHops; i++) {
    const period = await ensureSalaryPeriod(db, teacherId, ym);
    if (!isSettledStatus(period.status)) return period;
    ym = nextMonth(ym);
  }
  throw new Error("settlement davri topilmadi (36 oy ichida ochiq davr yo'q)");
}
