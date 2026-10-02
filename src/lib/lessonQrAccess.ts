import "server-only";
import { prisma } from "./db";

/**
 * QR orqali dars videosini ko'rish huquqi: o'quvchi markazning istalgan
 * guruhida FAOL bo'lishi yetarli (dars o'z kursidan bo'lishi shart emas).
 */
export interface QrStudent {
  id: string;
  currentLevel: string | null;
  /** Faol guruhlar — eng oxirgi qo'shilgani birinchi (ilova ham shuni "asosiy" deb oladi) */
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
