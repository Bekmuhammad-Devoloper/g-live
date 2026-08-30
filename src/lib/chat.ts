import "server-only";
import { prisma } from "./db";

// O'quvchi–ustoz yozishmasi. Suhbat (studentId + teacherId) bilan aniqlanadi.
// Ustoz biriktirilmagan bo'lsa teacherId = null — xabar ma'muriyatga qoladi.

export const CHAT_MAX = 1000;

export async function activeTeacherOf(studentId: string): Promise<string | null> {
  const en = await prisma.groupStudent.findFirst({
    where: { studentId, isActive: true },
    orderBy: { joinedAt: "desc" },
    select: { group: { select: { teacherId: true } } },
  });
  return en?.group.teacherId ?? null;
}

// O'quvchining o'qilmagan xabarlari (ustozdan kelgan)
export function unreadForStudent(studentId: string) {
  return prisma.chatMessage.count({ where: { studentId, fromStudent: false, readAt: null } });
}

// Ustozning o'qilmagan xabarlari (o'quvchilardan kelgan)
export function unreadForTeacher(teacherId: string) {
  return prisma.chatMessage.count({ where: { teacherId, fromStudent: true, readAt: null } });
}
