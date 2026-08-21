import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";

// Ustozlar davomati avtomatikasi (2026-08-21 talab):
// o'qituvchi O'Z guruhida davomat o'tkazsa (o'quvchilarni belgilasa, QR yaratsa
// yoki ro'yxatni tasdiqlasa) — /teacher-attendance jadvalida o'sha kunga
// avtomatik "keldi" (✓) tushadi.
//
// Mavjud yozuvga TEGILMAYDI: rahbariyat (menejer/direktor/o'rinbosar) qo'lda
// qo'ygan holat (masalan "kelmadi") avtomat bilan qayta yozilmaydi — davomatni
// faqat ular o'zgartira oladi, avtomat esa bo'sh katakni to'ldiradi xolos.

const p2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

async function upsertPresent(teacherId: string, dateISO: string): Promise<void> {
  const date = new Date(dateISO + "T00:00:00");
  if (isNaN(date.getTime())) return;
  await prisma.teacherAttendance.upsert({
    where: { teacherId_date: { teacherId, date } },
    create: { teacherId, date, present: true },
    update: {}, // bor yozuv o'zgarmaydi — rahbariyat qarori ustun
  });
}

/** Guruh + sana ma'lum bo'lgan yo'llar uchun (guruh sahifasidagi davomat). */
export async function autoMarkTeacherPresent(
  actor: { userId: string; role: string },
  groupId: string,
  dateISO: string,
): Promise<void> {
  try {
    if (actor.role !== ROLES.TEACHER) return;
    const g = await prisma.group.findUnique({ where: { id: groupId }, select: { teacherId: true } });
    if (!g || g.teacherId !== actor.userId) return;
    await upsertPresent(actor.userId, dateISO);
  } catch {
    /* yordamchi amal — asosiy davomat belgilashni to'xtatmasin */
  }
}

/** Dars orqali keladigan yo'llar uchun (dars sahifasi, /attendance, QR). */
export async function autoMarkTeacherPresentForLesson(
  actor: { userId: string; role: string },
  lessonId: string,
): Promise<void> {
  try {
    if (actor.role !== ROLES.TEACHER) return;
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { startsAt: true, group: { select: { teacherId: true } } },
    });
    if (!lesson || lesson.group.teacherId !== actor.userId) return;
    await upsertPresent(actor.userId, isoOf(lesson.startsAt));
  } catch {
    /* yordamchi amal — asosiy davomat belgilashni to'xtatmasin */
  }
}
