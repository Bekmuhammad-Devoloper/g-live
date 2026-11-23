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

export const PAY_GRACE_ROLES: string[] = ["ADMIN", "DIRECTOR", "DEPUTY_DIRECTOR"];
export const PAY_GRACE_MAX_DAYS = 60;

export interface PaymentState {
  mandatory: boolean;
  daysUnpaid: number;
  graceUntil: string | null;
}

export async function isPaymentMandatory(studentId: string): Promise<PaymentState> {
  return (await isPaymentMandatoryBulk([studentId])).get(studentId) ?? { mandatory: false, daysUnpaid: 0, graceUntil: null };
}

export async function isPaymentMandatoryBulk(studentIds: string[]): Promise<Map<string, PaymentState>> {
  const now = new Date();
  const [days, debts, graces] = await Promise.all([
    unpaidDaysMap(studentIds, now),
    computeDebts(studentIds, now),
    studentIds.length ? prisma.student.findMany({ where: { id: { in: studentIds }, payGraceUntil: { gte: now } }, select: { id: true, payGraceUntil: true } }) : Promise.resolve([]),
  ]);
  const grace = new Map(graces.map((g) => [g.id, g.payGraceUntil]));
  const out = new Map<string, PaymentState>();
  for (const id of studentIds) {
    const d = days.get(id) ?? 0;
    const inDebt = (debts.get(id)?.debt ?? 0) > 0;
    const until = grace.get(id) ?? null;
    out.set(id, { mandatory: inDebt && d >= UNPAID_GRACE_DAYS && !until, daysUnpaid: d, graceUntil: until ? until.toISOString() : null });
  }
  return out;
}
