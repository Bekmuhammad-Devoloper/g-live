import "server-only";
import { prisma } from "./db";

// To'lovsiz o'qish muddati (kun): oxirgi to'lovdan (to'lov bo'lmasa — guruhga
// qo'shilgan kundan) shuncha kun o'tgach to'lov MAJBURIY bo'ladi (davomat bloklanadi).
export const UNPAID_GRACE_DAYS = 30;

const DAY_MS = 86_400_000;

/** Oxirgi PAID to'lov sanasi va faol guruhga eng erta qo'shilgan sana bo'yicha to'lovsiz kunlar soni. */
async function unpaidDaysMap(studentIds: string[], now = new Date()): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (studentIds.length === 0) return out;
  const [lastPaid, joined] = await Promise.all([
    prisma.payment.groupBy({ by: ["studentId"], where: { studentId: { in: studentIds }, status: "PAID" }, _max: { createdAt: true } }),
    prisma.groupStudent.groupBy({ by: ["studentId"], where: { studentId: { in: studentIds }, isActive: true }, _min: { joinedAt: true } }),
  ]);
  const paidAt = new Map(lastPaid.map((p) => [p.studentId, p._max.createdAt]));
  const joinedAt = new Map(joined.map((j) => [j.studentId, j._min.joinedAt]));
  for (const id of studentIds) {
    const anchor = paidAt.get(id) ?? joinedAt.get(id) ?? null;
    out.set(id, anchor ? Math.max(0, Math.floor((now.getTime() - anchor.getTime()) / DAY_MS)) : 0);
  }
  return out;
}

/** To'lov MAJBURIY holatga o'tganmi: oxirgi to'lovdan (yoki guruhga qo'shilgandan) UNPAID_GRACE_DAYS kun o'tgan. */
export async function isPaymentMandatory(studentId: string): Promise<{ mandatory: boolean; daysUnpaid: number }> {
  const daysUnpaid = (await unpaidDaysMap([studentId])).get(studentId) ?? 0;
  return { mandatory: daysUnpaid >= UNPAID_GRACE_DAYS, daysUnpaid };
}

/** Bir nechta o'quvchi uchun bir martada (guruh davomati sahifasi uchun samaraliroq). */
export async function isPaymentMandatoryBulk(studentIds: string[]): Promise<Map<string, { mandatory: boolean; daysUnpaid: number }>> {
  const days = await unpaidDaysMap(studentIds);
  const out = new Map<string, { mandatory: boolean; daysUnpaid: number }>();
  for (const id of studentIds) {
    const d = days.get(id) ?? 0;
    out.set(id, { mandatory: d >= UNPAID_GRACE_DAYS, daysUnpaid: d });
  }
  return out;
}
