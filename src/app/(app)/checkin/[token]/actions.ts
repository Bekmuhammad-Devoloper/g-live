"use server";

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { lessonLockState } from "@/lib/attendanceWindow";

export type CheckInResult = "ok" | "expired" | "invalid" | "anomaly" | "already" | "notstudent";

export async function checkIn(token: string): Promise<CheckInResult> {
  const s = await requireSession();

  const student = await prisma.student.findUnique({ where: { userId: s.userId } });
  if (!student) return "notstudent";

  const lesson = await prisma.lesson.findFirst({ where: { qrToken: token } });
  if (!lesson) return "invalid";

  if (!lesson.qrExpiresAt || lesson.qrExpiresAt.getTime() < Date.now()) return "expired";

  const lock = await lessonLockState(lesson.id);
  if (lock && lock.closed && !lock.unlocked) return "expired";

  const existing = await prisma.attendance.findUnique({
    where: { lessonId_studentId: { lessonId: lesson.id, studentId: student.id } },
  });
  if (existing && existing.status !== "ABSENT") return "already";

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
