import "server-only";
import { prisma } from "./db";

export interface QrStudent {
  id: string;
  currentLevel: string | null;
  groups: { id: string; programId: string; levelCode: string | null }[];
}

export async function qrStudentOf(userId: string): Promise<QrStudent | null> {
  const st = await prisma.student.findUnique({
    where: { userId },
    select: {
      id: true,
      currentLevel: true,
      enrollments: {
        where: { isActive: true },
        orderBy: { joinedAt: "desc" },
        select: { group: { select: { id: true, programId: true, levelCode: true } } },
      },
    },
  });
  if (!st) return null;
  return { id: st.id, currentLevel: st.currentLevel, groups: st.enrollments.map((e) => e.group) };
}
