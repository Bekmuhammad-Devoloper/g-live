"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, type SessionUser } from "@/lib/auth";
import { getPermission, MODULES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { ATTENDANCE_STATUSES } from "@/lib/constants";
import { canBypassAttendanceLock, lessonLockState } from "@/lib/attendanceWindow";
import { autoMarkTeacherPresentForLesson } from "@/lib/teacherAutoAttendance";

async function canManageLesson(s: SessionUser, lessonId: string): Promise<{ ok: boolean; groupId?: string }> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { groupId: true, group: { select: { teacherId: true } } },
  });
  if (!lesson) return { ok: false };
  const full = getPermission(s.role, MODULES.ATTENDANCE) === "FULL";
  const owner = lesson.group.teacherId === s.userId;
  return { ok: full || owner, groupId: lesson.groupId };
}

// Dinamik QR yaratish — TZ FR-HW-06 (faqat belgilangan vaqt oralig'ida amal qiladi)
export async function generateQr(lessonId: string, minutes = 15): Promise<void> {
  const s = await requireSession();
  const { ok, groupId } = await canManageLesson(s, lessonId);
  if (!ok) return;

  // Yopilgan (dars + 3 soat o'tgan) darsga yangi QR berilmaydi — avto-"yo'q"ni
  // QR orqali o'chirish yo'lini yopadi. Ruxsat (unlock) berilgan bo'lsa mumkin.
  if (!canBypassAttendanceLock(s.role)) {
    const lock = await lessonLockState(lessonId);
    if (lock && lock.closed && !lock.unlocked) return;
  }

  const token = randomUUID();
  const expires = new Date(Date.now() + minutes * 60 * 1000);
  await prisma.lesson.update({ where: { id: lessonId }, data: { qrToken: token, qrExpiresAt: expires } });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Lesson", entityId: lessonId, reason: "QR yaratildi" });
  await autoMarkTeacherPresentForLesson(s, lessonId); // QR bilan dars o'tkazish ham davomat hisoblanadi
  revalidatePath(`/groups/${groupId}/lessons/${lessonId}`);
}

// Davomatni qo'lda belgilash
export async function markAttendance(lessonId: string, studentId: string, status: string): Promise<void> {
  const s = await requireSession();
  const { ok, groupId } = await canManageLesson(s, lessonId);
  if (!ok) return;
  if (!ATTENDANCE_STATUSES.includes(status as (typeof ATTENDANCE_STATUSES)[number])) return;

  // Davomat oynasi yopilgan bo'lsa (dars + 3 soat) — faqat rahbariyat yoki unlock bilan
  if (!canBypassAttendanceLock(s.role)) {
    const lock = await lessonLockState(lessonId);
    if (lock && lock.closed && !lock.unlocked) return;
  }

  await prisma.attendance.upsert({
    where: { lessonId_studentId: { lessonId, studentId } },
    create: { lessonId, studentId, status, method: "MANUAL", confirmed: false },
    update: { status, method: "MANUAL" },
  });
  await autoMarkTeacherPresentForLesson(s, lessonId); // ustozlar davomatiga avtomatik ✓
  revalidatePath(`/groups/${groupId}/lessons/${lessonId}`);
}

// O'qituvchi yakuniy ro'yxatni tasdiqlaydi — TZ FR-HW-08
export async function confirmAttendance(lessonId: string): Promise<void> {
  const s = await requireSession();
  const { ok, groupId } = await canManageLesson(s, lessonId);
  if (!ok) return;

  await prisma.attendance.updateMany({ where: { lessonId }, data: { confirmed: true } });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Lesson", entityId: lessonId, reason: "Davomat tasdiqlandi" });
  await autoMarkTeacherPresentForLesson(s, lessonId); // ustozlar davomatiga avtomatik ✓
  revalidatePath(`/groups/${groupId}/lessons/${lessonId}`);
}
