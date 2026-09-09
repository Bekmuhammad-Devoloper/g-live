"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { tr } from "@/lib/tr";
import { canWrite, MODULES } from "@/lib/rbac";
import { ROLES, ATTENDANCE_STATUSES } from "@/lib/constants";
import { writeAudit } from "@/lib/audit";
import { canBypassAttendanceLock, lessonLockState } from "@/lib/attendanceWindow";
import { autoMarkTeacherPresentForLesson } from "@/lib/teacherAutoAttendance";

// Faqat o'z guruhi (o'qituvchi) yoki to'liq ruxsatga ega rahbariyat davomat belgilaydi.
// Menejer/Direktor/Admin — faqat ko'rish (READ), talaba/ota-ona — belgilay olmaydi.
const CAN_MARK_ROLES = [ROLES.TEACHER, ROLES.DEPUTY_DIRECTOR];

type Session = Awaited<ReturnType<typeof requireSession>>;

async function guardLesson(s: Session, lessonId: string) {
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
  const s = await requireSession();
  const g = await guardLesson(s, lessonId);
  if (!g) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };
  if (!ATTENDANCE_STATUSES.includes(status as never)) return { error: tr(s.locale, { uz: "Holat noto'g'ri", ru: "Неверный статус", en: "Invalid status", de: "Ungültiger Status" }) };

  // Davomat oynasi — dars + 3 soatdan keyin yopiladi (guruh sahifasidagi qoida bilan bir xil)
  if (!canBypassAttendanceLock(g.s.role)) {
    const lock = await lessonLockState(lessonId);
    if (lock && lock.closed && !lock.unlocked) {
      return { error: tr(s.locale, { uz: "Davomat yopilgan (dars + 3 soat o'tdi) — menejer yoki direktor ruxsati kerak", ru: "Посещаемость закрыта (прошло 3 часа после урока) — нужно разрешение менеджера или директора", en: "Attendance is closed (lesson + 3 hours passed) — manager or director approval required", de: "Anwesenheit ist geschlossen (Unterricht + 3 Stunden vorbei) — Freigabe durch Manager oder Direktor erforderlich" }) };
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
  const s = await requireSession();
  const g = await guardLesson(s, lessonId);
  if (!g) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };

  await prisma.attendance.updateMany({ where: { lessonId }, data: { confirmed: true } });
  await writeAudit({ actorId: g.s.userId, action: "UPDATE", entityType: "Lesson", entityId: lessonId, newValue: { confirmed: true } });

  revalidatePath("/attendance");
  return { ok: true };
}
