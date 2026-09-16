// Finance V2 — cutover lahzasi (server-only'siz: dvigatel, CLI va testlar uchun).
//
// S1: cutover'dan OLDINGI davr — legacy. Oldingi davr to'lovi yoki xizmat oyi
// V2 earning'iga aylanganda avtomatik POSTED bo'lmaydi — NEEDS_REVIEW (inson qaror
// qiladi: legacy fiksa allaqachon to'langan bo'lishi mumkin — ikki marta to'lash xavfi).

import type { FinanceDb } from "./db";
import { FINANCE_SETTING_KEYS, FINANCE_V2_DEFAULT_CUTOVER_ISO } from "./constants";
import { isTashkentMonthStart } from "./period";

/** Buzuq yoki oy o'rtasidagi qiymat → tasdiqlangan standart (R11) */
export function parseCutoverAt(raw: string | undefined | null): Date {
  const parsed = new Date(raw ?? FINANCE_V2_DEFAULT_CUTOVER_ISO);
  const valid = !Number.isNaN(parsed.getTime()) && isTashkentMonthStart(parsed);
  return valid ? parsed : new Date(FINANCE_V2_DEFAULT_CUTOVER_ISO);
}

/** Cutover — berilgan ulanish (tranzaksiya) orqali `Setting` dan */
export async function cutoverAtFrom(db: FinanceDb): Promise<Date> {
  const row = await db.setting.findUnique({ where: { key: FINANCE_SETTING_KEYS.cutoverAt }, select: { value: true } });
  return parseCutoverAt(row?.value);
}
