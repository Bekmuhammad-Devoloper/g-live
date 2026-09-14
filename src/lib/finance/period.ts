// Finance V2 — oy chegaralari, Asia/Tashkent taqvimida.
//
// Nega alohida modul: loyihaning boshqa joylari `new Date().getMonth()` ga
// tayanadi — bu server TZ'siga bog'liq (prod'da systemd TZ=Asia/Tashkent,
// CI'da UTC). Moliyada "31-oktabr 23:59 qaysi oy?" savoli pulga ta'sir
// qiladi, shu sabab bu yerda TZ jarayon sozlamasidan QAT'I NAZAR aniq.
//
// Tashkent UTC+5, yozgi vaqt yo'q (1991 dan) — oy boshini hisoblash uchun
// doimiy siljish yetarli; testlar buni Intl bilan solishtirib tasdiqlaydi.

import { FINANCE_TZ } from "./constants";

export interface YearMonth {
  year: number;
  /** 1–12 */
  month: number;
}

/** Tashkent = UTC+5 (daqiqada). Intl bilan test orqali tasdiqlanadi. */
export const TASHKENT_UTC_OFFSET_MINUTES = 5 * 60;

const OFFSET_MS = TASHKENT_UTC_OFFSET_MINUTES * 60 * 1000;

const ymFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: FINANCE_TZ,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

function tashkentParts(at: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = ymFormatter.formatToParts(at);
  const pick = (type: string): number => Number(parts.find((p) => p.type === type)?.value);
  return { year: pick("year"), month: pick("month"), day: pick("day"), hour: pick("hour"), minute: pick("minute") };
}

/** Berilgan lahza Tashkent taqvimida qaysi (yil, oy)ga tushadi */
export function tashkentYearMonth(at: Date): YearMonth {
  const { year, month } = tashkentParts(at);
  return { year, month };
}

export function assertYearMonth(ym: YearMonth): void {
  if (!Number.isInteger(ym.year) || ym.year < 2000 || ym.year > 2100) throw new RangeError(`yil noto'g'ri: ${ym.year}`);
  if (!Number.isInteger(ym.month) || ym.month < 1 || ym.month > 12) throw new RangeError(`oy noto'g'ri: ${ym.month}`);
}

/** Oyning birinchi kuni 00:00 Tashkent — UTC lahza sifatida */
export function monthStart(ym: YearMonth): Date {
  assertYearMonth(ym);
  return new Date(Date.UTC(ym.year, ym.month - 1, 1) - OFFSET_MS);
}

/** Keyingi oyning boshi (chegara EXCLUSIVE: `>= monthStart && < monthEnd`) */
export function monthEnd(ym: YearMonth): Date {
  return monthStart(nextMonth(ym));
}

export function nextMonth(ym: YearMonth): YearMonth {
  assertYearMonth(ym);
  return ym.month === 12 ? { year: ym.year + 1, month: 1 } : { year: ym.year, month: ym.month + 1 };
}

export function prevMonth(ym: YearMonth): YearMonth {
  assertYearMonth(ym);
  return ym.month === 1 ? { year: ym.year - 1, month: 12 } : { year: ym.year, month: ym.month - 1 };
}

/** Oylarni solishtirish uchun butun indeks (yil*12 + oy−1) */
export function monthIndex(ym: YearMonth): number {
  assertYearMonth(ym);
  return ym.year * 12 + (ym.month - 1);
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return monthIndex(a) - monthIndex(b);
}

export function isSameYearMonth(a: YearMonth, b: YearMonth): boolean {
  return a.year === b.year && a.month === b.month;
}

/** "2026-10" — chargeKey, idempotencyKey va hisobotlar uchun */
export function yearMonthKey(ym: YearMonth): string {
  assertYearMonth(ym);
  return `${ym.year}-${String(ym.month).padStart(2, "0")}`;
}

export function parseYearMonthKey(key: string): YearMonth {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) throw new RangeError(`oy kaliti noto'g'ri: ${key}`);
  const ym = { year: Number(m[1]), month: Number(m[2]) };
  assertYearMonth(ym);
  return ym;
}

/** `from` dan `to` gacha (ikkalasi ham kiradi) oylar ro'yxati; from > to bo'lsa bo'sh */
export function monthsBetween(from: YearMonth, to: YearMonth): YearMonth[] {
  const out: YearMonth[] = [];
  for (let cur = from; compareYearMonth(cur, to) <= 0; cur = nextMonth(cur)) out.push(cur);
  return out;
}

/** Lahza aynan Tashkent oy boshimi (qoida/siyosat `effectiveFrom` validatsiyasi) */
export function isTashkentMonthStart(at: Date): boolean {
  return at.getTime() === monthStart(tashkentYearMonth(at)).getTime();
}

/** Lahzani o'z oyining boshiga tenglashtiradi */
export function floorToTashkentMonth(at: Date): Date {
  return monthStart(tashkentYearMonth(at));
}

/** Oydagi kunlar soni */
export function daysInMonth(ym: YearMonth): number {
  assertYearMonth(ym);
  return new Date(Date.UTC(ym.year, ym.month, 0)).getUTCDate();
}

/**
 * Oyning `day`-kuni 00:00 Tashkent (masalan dueDate = dueDay). Kun oy
 * uzunligidan katta bo'lsa oxirgi kunga qisqartiriladi (31 → fevral 28).
 */
export function tashkentDate(ym: YearMonth, day: number): Date {
  assertYearMonth(ym);
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new RangeError(`kun noto'g'ri: ${day}`);
  const d = Math.min(day, daysInMonth(ym));
  return new Date(Date.UTC(ym.year, ym.month - 1, d) - OFFSET_MS);
}

/** Lahza [from, to) oralig'idami; `to` null = ochiq (cheksiz) */
export function isWithin(at: Date, from: Date, to: Date | null | undefined): boolean {
  const t = at.getTime();
  return t >= from.getTime() && (to === null || to === undefined || t < to.getTime());
}
