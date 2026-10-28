import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";

const p2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

async function upsertPresent(teacherId: string, dateISO: string): Promise<void> {
  const date = new Date(dateISO + "T00:00:00");
  if (isNaN(date.getTime())) return;
  await prisma.teacherAttendance.upsert({
    where: { teacherId_date: { teacherId, date } },
    create: { teacherId, date, present: true },
    update: {},
  });
}

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
  }
}

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
  }
}
