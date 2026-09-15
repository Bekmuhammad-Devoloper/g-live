// Finance V2 — davomat nisbati (S9). Salary trigger EMAS — faqat eligibility bazasi.
// lessons = xizmat oyidagi guruh darslari (Lesson.startsAt, Tashkent oy);
// present = o'quvchining hisobga olinadigan statusdagi davomati (policy ro'yxati,
// kerak bo'lsa faqat ustoz tasdiqlagan). Dars yo'q → ratio null (NEEDS_REVIEW, S9).

import type { FinanceDb } from "../db";
import { monthEnd, monthStart, type YearMonth } from "../period";
import type { SalaryPolicyView } from "./policy";

export interface AttendanceRatio {
  lessons: number;
  present: number;
  /** present/lessons; dars yo'q bo'lsa null */
  ratio: { numerator: number; denominator: number } | null;
}

export async function attendanceRatio(db: FinanceDb, i: { studentId: string; groupId: string; serviceMonth: YearMonth; policy: Pick<SalaryPolicyView, "attendanceCountedStatuses" | "requireConfirmedAttendance"> }): Promise<AttendanceRatio> {
  const lessons = await db.lesson.findMany({
    where: { groupId: i.groupId, startsAt: { gte: monthStart(i.serviceMonth), lt: monthEnd(i.serviceMonth) } },
    select: { id: true },
  });
  if (lessons.length === 0) return { lessons: 0, present: 0, ratio: null };
  const present = await db.attendance.count({
    where: {
      studentId: i.studentId, lessonId: { in: lessons.map((l) => l.id) },
      status: { in: i.policy.attendanceCountedStatuses }, ...(i.policy.requireConfirmedAttendance ? { confirmed: true } : {}),
    },
  });
  return { lessons: lessons.length, present, ratio: { numerator: present, denominator: lessons.length } };
}
