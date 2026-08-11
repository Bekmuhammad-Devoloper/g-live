"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getPermission, MODULES } from "@/lib/rbac";
import { ROLES } from "@/lib/constants";

// Guruh o'qituvchisi yoki rahbariyat (FULL)
async function canMark(groupId: string): Promise<boolean> {
  const s = await requireSession();
  if (getPermission(s.role, MODULES.GROUPS) === "FULL") return true;
  if (s.role === ROLES.TEACHER) {
    const g = await prisma.group.findUnique({ where: { id: groupId }, select: { teacherId: true } });
    return g?.teacherId === s.userId;
  }
  return false;
}

// Guruh uchun darsni "o'tildi/o'tilmadi" qilib belgilash
export async function setLessonTaught(groupId: string, courseLessonId: string, taught: boolean): Promise<{ ok: boolean }> {
  if (!(await canMark(groupId))) return { ok: false };
  await prisma.groupLessonProgress.upsert({
    where: { groupId_courseLessonId: { groupId, courseLessonId } },
    create: { groupId, courseLessonId, taught, taughtAt: taught ? new Date() : null },
    update: { taught, taughtAt: taught ? new Date() : null },
  });
  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}
