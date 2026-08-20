"use server";

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { lessonLockState } from "@/lib/attendanceWindow";

export type CheckInResult = "ok" | "expired" | "invalid" | "anomaly" | "already" | "notstudent";

// O'quvchi QR skanerlab o'zini belgilaydi.
export async function checkIn(token: string): Promise<CheckInResult> {
  const s = await requireSession();

  const student = await prisma.student.findUnique({ where: { userId: s.userId } });
  if (!student) return "notstudent";

  const lesson = await prisma.lesson.findFirst({ where: { qrToken: token } });
  if (!lesson) return "invalid";

  // TZ FR-HW-06 — amal muddati tugagan QR qabul qilinmaydi
  if (!lesson.qrExpiresAt || lesson.qrExpiresAt.getTime() < Date.now()) return "expired";

  // Davomat oynasi yopilgan dars (dars + 3 soat o'tgan) — eski QR bilan ham kirib bo'lmaydi
  const lock = await lessonLockState(lesson.id);
  if (lock && lock.closed && !lock.unlocked) return "expired";

  // Allaqachon belgilanganmi?
  const existing = await prisma.attendance.findUnique({
    where: { lessonId_studentId: { lessonId: lesson.id, studentId: student.id } },
  });
  if (existing && existing.status !== "ABSENT") return "already";

  // TZ FR-HW-07 — guruhga biriktirilmagan bo'lsa anomaliya
  const enrolled = await prisma.groupStudent.findUnique({
    where: { groupId_studentId: { groupId: lesson.groupId, studentId: student.id } },
  });
  const anomaly = !enrolled;

  await prisma.attendance.upsert({
    where: { lessonId_studentId: { lessonId: lesson.id, studentId: student.id } },
    create: { lessonId: lesson.id, studentId: student.id, status: "PRESENT", method: "QR", anomaly },
    update: { status: "PRESENT", method: "QR", anomaly },
  });

  return anomaly ? "anomaly" : "ok";
}
