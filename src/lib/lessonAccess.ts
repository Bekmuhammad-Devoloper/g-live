import "server-only";
import { prisma } from "./db";
import { ROLES } from "./constants";

/**
 * Dars rejasi (video darslik, lug'at, topshiriq, uy vazifasi fayllari) va kurs
 * materiallarini yuklash / tahrirlash / o'chirish huquqi.
 *
 * Faqat direktor, ROP va o'qituvchi. Qolgan rollar (o'rinbosar, administrator,
 * menejer ...) shu ma'lumotni ko'radi, lekin o'zgartira olmaydi.
 */
const LESSON_EDITOR_ROLES: string[] = [ROLES.DIRECTOR, ROLES.ROP, ROLES.TEACHER];

export const canEditLessons = (role: string): boolean => LESSON_EDITOR_ROLES.includes(role);

/** Aniq kurs bo'yicha: o'qituvchi faqat o'zi dars beradigan guruhlarning kursida ishlaydi */
export async function canEditProgramLessons(s: { role: string; userId: string }, programId: string): Promise<boolean> {
  if (!canEditLessons(s.role)) return false;
  if (s.role !== ROLES.TEACHER) return true;
  const own = await prisma.group.count({ where: { programId, teacherId: s.userId } });
  return own > 0;
}
