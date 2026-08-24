import "server-only";
import { prisma } from "./db";

// Qarzni o'quvchi GURUHGA QO'SHILGAN KUNDAN boshlab hisoblash (2026-08-24 talab).
//
// Qoida: to'lov rejimi — kalendar oyi. O'quvchi qaysi oyda guruhga qo'shilsa,
// o'sha oy TO'LIQ hisoblanadi (masalan 20-avgustda qo'shilsa, avgust ham
// hisobga kiradi). Har o'tgan oy uchun guruh oylik to'lovi qo'shib boriladi.
//
// Oylik to'lov: avval guruhning o'z narxi (Group.monthlyFee), bo'lmasa kurs
// narxi (Program.monthlyFee). Ikkalasi ham kiritilmagan bo'lsa — hisoblanmaydi
// (narx belgilamagan markazlarda hech narsa o'zgarmaydi).
//
// Umumiy qarz = (hisoblangan − to'langan) + qo'lda kiritilgan qarz (PENDING).

export interface StudentDebt {
  /** Qo'shilgan oydan hozirgacha hisoblangan jami to'lov */
  accrued: number;
  /** PAID holatidagi to'lovlar yig'indisi */
  paid: number;
  /** Qo'lda kiritilgan qarz (PENDING to'lovlar) */
  manual: number;
  /** Umumiy qarz — ro'yxatlarda shu ko'rsatiladi */
  debt: number;
  /** Nechta oy hisoblangan (eng uzun a'zolik bo'yicha) */
  months: number;
  /** Hisob boshlangan sana (eng erta qo'shilish) */
  since: Date | null;
}

const EMPTY: StudentDebt = { accrued: 0, paid: 0, manual: 0, debt: 0, months: 0, since: null };

/**
 * Ikki sana orasidagi to'lov oylari soni — qo'shilgan oyning O'ZI ham kiradi.
 * leftAt berilgan bo'lsa hisob o'sha oyda to'xtaydi.
 */
export function billedMonths(joinedAt: Date, now: Date, leftAt?: Date | null): number {
  const end = leftAt && leftAt.getTime() < now.getTime() ? leftAt : now;
  const n = (end.getFullYear() - joinedAt.getFullYear()) * 12 + (end.getMonth() - joinedAt.getMonth()) + 1;
  return Math.max(0, n);
}

/** Bir nechta o'quvchi uchun bir martada (ro'yxat sahifalari uchun). */
export async function computeDebts(studentIds: string[], now = new Date()): Promise<Map<string, StudentDebt>> {
  const out = new Map<string, StudentDebt>();
  if (studentIds.length === 0) return out;

  const [enrollments, payments] = await Promise.all([
    prisma.groupStudent.findMany({
      where: { studentId: { in: studentIds } },
      select: {
        studentId: true,
        joinedAt: true,
        leftAt: true,
        isActive: true,
        group: { select: { monthlyFee: true, program: { select: { monthlyFee: true } } } },
      },
    }),
    prisma.payment.findMany({
      where: { studentId: { in: studentIds }, status: { in: ["PAID", "PENDING"] } },
      select: { studentId: true, amount: true, status: true },
    }),
  ]);

  for (const id of studentIds) out.set(id, { ...EMPTY });

  for (const e of enrollments) {
    const cur = out.get(e.studentId);
    if (!cur) continue;
    const fee = e.group.monthlyFee ?? e.group.program.monthlyFee ?? 0;
    // Guruhdan chiqarilgan bo'lsa (isActive=false) va sana yozilmagan bo'lsa —
    // eski yozuvlarda leftAt yo'q, hisobni davom ettirmaymiz.
    const leftAt = e.leftAt ?? (e.isActive ? null : e.joinedAt);
    const months = billedMonths(e.joinedAt, now, leftAt);
    if (fee > 0) cur.accrued += fee * months;
    if (months > cur.months) cur.months = months;
    if (!cur.since || e.joinedAt < cur.since) cur.since = e.joinedAt;
  }

  for (const p of payments) {
    const cur = out.get(p.studentId);
    if (!cur) continue;
    if (p.status === "PAID") cur.paid += p.amount;
    else cur.manual += p.amount;
  }

  for (const v of out.values()) {
    v.debt = Math.max(0, v.accrued - v.paid) + v.manual;
  }
  return out;
}

/** Bitta o'quvchi uchun. */
export async function computeDebt(studentId: string, now = new Date()): Promise<StudentDebt> {
  const m = await computeDebts([studentId], now);
  return m.get(studentId) ?? { ...EMPTY };
}
