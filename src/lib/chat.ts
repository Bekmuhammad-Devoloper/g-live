import "server-only";
import { prisma } from "./db";

export const CHAT_MAX = 1000;

export async function activeTeacherOf(studentId: string): Promise<string | null> {
  const en = await prisma.groupStudent.findFirst({
    where: { studentId, isActive: true },
    orderBy: { joinedAt: "desc" },
    select: { group: { select: { teacherId: true } } },
  });
  return en?.group.teacherId ?? null;
}

export function unreadForStudent(studentId: string) {
  return prisma.chatMessage.count({ where: { studentId, fromStudent: false, readAt: null } });
}

export function unreadForTeacher(teacherId: string) {
  return prisma.chatMessage.count({ where: { teacherId, fromStudent: true, readAt: null } });
}
