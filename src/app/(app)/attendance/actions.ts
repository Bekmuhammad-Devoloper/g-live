"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canWrite, MODULES } from "@/lib/rbac";
import { ROLES, ATTENDANCE_STATUSES } from "@/lib/constants";
import { writeAudit } from "@/lib/audit";
import { canBypassAttendanceLock, lessonLockState } from "@/lib/attendanceWindow";
import { autoMarkTeacherPresentForLesson } from "@/lib/teacherAutoAttendance";

// Faqat o'z guruhi (o'qituvchi) yoki to'liq ruxsatga ega rahbariyat davomat belgilaydi.
// Menejer/Direktor/Admin — faqat ko'rish (READ), talaba/ota-ona — belgilay olmaydi.
const CAN_MARK_ROLES = [ROLES.TEACHER, ROLES.DEPUTY_DIRECTOR];

async function guardLesson(lessonId: string) {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.ATTENDANCE)) return null;
  if (!CAN_MARK_ROLES.includes(s.role as never)) return null;
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { group: { select: { teacherId: true } } },
  });
  if (!lesson) return null;
  // O'qituvchi faqat o'z guruhidagi darsni belgilay oladi
  if (s.role === ROLES.TEACHER && lesson.group.teacherId !== s.userId) return null;
  return { s, lesson };
}

/** Bitta o'quvchining berilgan darsdagi davomat holatini belgilaydi (upsert). */
export async function markAttendance(lessonId: string, studentId: string, status: string): Promise<{ ok?: boolean; error?: string }> {
  const g = await guardLesson(lessonId);
  if (!g) return { error: "Ruxsat yo'q" };
  if (!ATTENDANCE_STATUSES.includes(status as never)) return { error: "Holat noto'g'ri" };

  // Davomat oynasi — dars + 3 soatdan keyin yopiladi (guruh sahifasidagi qoida bilan bir xil)
  if (!canBypassAttendanceLock(g.s.role)) {
    const lock = await lessonLockState(lessonId);
    if (lock && lock.closed && !lock.unlocked) {
      return { error: "Davomat yopilgan (dars + 3 soat o'tdi) — menejer yoki direktor ruxsati kerak" };
    }
  }

  await prisma.attendance.upsert({
    where: { lessonId_studentId: { lessonId, studentId } },
    create: { lessonId, studentId, status, method: "MANUAL", confirmed: false },
    update: { status, method: "MANUAL", markedAt: new Date() },
  });

  await writeAudit({
    actorId: g.s.userId,
    action: "UPDATE",
    entityType: "Attendance",
    entityId: `${lessonId}:${studentId}`,
    newValue: { status, method: "MANUAL" },
  });

  await autoMarkTeacherPresentForLesson(g.s, lessonId); // ustozlar davomatiga avtomatik ✓
  revalidatePath("/attendance");
  return { ok: true };
}

/** Dars bo'yicha butun ro'yxatni tasdiqlaydi (barcha yozuvlar confirmed = true). */
export async function confirmLesson(lessonId: string): Promise<{ ok?: boolean; error?: string }> {
  const g = await guardLesson(lessonId);
  if (!g) return { error: "Ruxsat yo'q" };

  await prisma.attendance.updateMany({ where: { lessonId }, data: { confirmed: true } });
  await writeAudit({ actorId: g.s.userId, action: "UPDATE", entityType: "Lesson", entityId: lessonId, newValue: { confirmed: true } });

  revalidatePath("/attendance");
  return { ok: true };
}
