import "server-only";
import { prisma } from "./db";
import { ROLES } from "./constants";

const LESSON_EDITOR_ROLES: string[] = [ROLES.DIRECTOR, ROLES.ROP, ROLES.TEACHER];

export const canEditLessons = (role: string): boolean => LESSON_EDITOR_ROLES.includes(role);

export async function canEditProgramLessons(s: { role: string; userId: string }, programId: string): Promise<boolean> {
  if (!canEditLessons(s.role)) return false;
  if (s.role !== ROLES.TEACHER) return true;
  const own = await prisma.group.count({ where: { programId, teacherId: s.userId } });
  return own > 0;
}
