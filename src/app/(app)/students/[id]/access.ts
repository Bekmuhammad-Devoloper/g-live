import "server-only";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { branchWhere } from "@/lib/branchScope";
import type { SessionUser } from "@/lib/auth";

// O'quvchi profilini ko'ra oladigan rollar — /students ro'yxati bilan bir xil.
// Profil sahifasi va profil ichidagi server amallari shu ro'yxatga tayanadi.
export const PROFILE_VIEW_ROLES: string[] = [
  ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER, ROLES.ADMIN, ROLES.TEACHER, ROLES.ACCOUNTANT,
];

/**
 * Profil sahifasidagi qoidaning o'zi: rol ruxsat etilgan, o'quvchi faol filial
 * doirasida, o'qituvchi esa faqat o'z guruhidagi o'quvchini ko'radi.
 */
export async function canViewStudentProfile(s: SessionUser, studentId: string): Promise<boolean> {
  if (!PROFILE_VIEW_ROLES.includes(s.role)) return false;
  const student = await prisma.student.findFirst({
    where: { AND: [{ id: studentId }, branchWhere(s)] },
    select: { id: true },
  });
  if (!student) return false;
  if (s.role === ROLES.TEACHER) {
    const mine = await prisma.groupStudent.findFirst({
      where: { studentId, group: { teacherId: s.userId } },
      select: { id: true },
    });
    if (!mine) return false;
  }
  return true;
}
