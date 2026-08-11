import "server-only";
import { prisma } from "./db";

// Har oy o'quvchiga beriladigan "imtiyozli" darslar soni — shundan keyin
// shu oy uchun to'lov MAJBURIY bo'ladi (davomat belgilash bloklanadi).
export const MANDATORY_LESSON_THRESHOLD = 3;

function monthRange(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end };
}

/** O'quvchi joriy oyda kamida bitta PAID to'lov qilganmi. */
export async function hasPaidThisMonth(studentId: string): Promise<boolean> {
  const { start, end } = monthRange();
  const count = await prisma.payment.count({ where: { studentId, status: "PAID", createdAt: { gte: start, lt: end } } });
  return count > 0;
}

/** Joriy oyda o'quvchiga necha dars o'tilgani (PRESENT/LATE belgilangan). */
export async function lessonsAttendedThisMonth(studentId: string): Promise<number> {
  const { start, end } = monthRange();
  return prisma.attendance.count({
    where: { studentId, status: { in: ["PRESENT", "LATE"] }, lesson: { startsAt: { gte: start, lt: end } } },
  });
}

/** To'lov MAJBURIY holatga o'tganmi: shu oy chegaradan ko'p dars o'tilgan, lekin to'lov qilinmagan. */
export async function isPaymentMandatory(studentId: string): Promise<{ mandatory: boolean; lessonsThisMonth: number; paid: boolean }> {
  const [lessonsThisMonth, paid] = await Promise.all([lessonsAttendedThisMonth(studentId), hasPaidThisMonth(studentId)]);
  return { mandatory: !paid && lessonsThisMonth >= MANDATORY_LESSON_THRESHOLD, lessonsThisMonth, paid };
}

/** Bir nechta o'quvchi uchun bir martada (guruh davomati sahifasi uchun samaraliroq). */
export async function isPaymentMandatoryBulk(studentIds: string[]): Promise<Map<string, { mandatory: boolean; lessonsThisMonth: number }>> {
  const out = new Map<string, { mandatory: boolean; lessonsThisMonth: number }>();
  if (studentIds.length === 0) return out;
  const { start, end } = monthRange();
  const [attendances, paidPayments] = await Promise.all([
    prisma.attendance.findMany({
      where: { studentId: { in: studentIds }, status: { in: ["PRESENT", "LATE"] }, lesson: { startsAt: { gte: start, lt: end } } },
      select: { studentId: true },
    }),
    prisma.payment.findMany({ where: { studentId: { in: studentIds }, status: "PAID", createdAt: { gte: start, lt: end } }, select: { studentId: true } }),
  ]);
  const lessonCount = new Map<string, number>();
  for (const a of attendances) lessonCount.set(a.studentId, (lessonCount.get(a.studentId) ?? 0) + 1);
  const paidSet = new Set(paidPayments.map((p) => p.studentId));
  for (const id of studentIds) {
    const n = lessonCount.get(id) ?? 0;
    out.set(id, { mandatory: !paidSet.has(id) && n >= MANDATORY_LESSON_THRESHOLD, lessonsThisMonth: n });
  }
  return out;
}
