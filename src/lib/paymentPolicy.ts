import "server-only";
import { prisma } from "./db";
import { computeDebts } from "./debt";

export const UNPAID_GRACE_DAYS = 30;

const DAY_MS = 86_400_000;

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

export async function isPaymentMandatory(studentId: string): Promise<{ mandatory: boolean; daysUnpaid: number }> {
  return (await isPaymentMandatoryBulk([studentId])).get(studentId) ?? { mandatory: false, daysUnpaid: 0 };
}

export async function isPaymentMandatoryBulk(studentIds: string[]): Promise<Map<string, { mandatory: boolean; daysUnpaid: number }>> {
  const [days, debts] = await Promise.all([unpaidDaysMap(studentIds), computeDebts(studentIds)]);
  const out = new Map<string, { mandatory: boolean; daysUnpaid: number }>();
  for (const id of studentIds) {
    const d = days.get(id) ?? 0;
    const inDebt = (debts.get(id)?.debt ?? 0) > 0;
    out.set(id, { mandatory: inDebt && d >= UNPAID_GRACE_DAYS, daysUnpaid: d });
  }
  return out;
}
