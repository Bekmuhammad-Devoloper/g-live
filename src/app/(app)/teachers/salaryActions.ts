"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { writeAudit } from "@/lib/audit";

// Maoshni faqat rahbariyat boshqaradi
function canManage(role: string) {
  return [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR].includes(role as never);
}

export async function setTeacherFiksa(teacherId: string, fiksa: number): Promise<void> {
  const s = await requireSession();
  if (!canManage(s.role)) return;
  const amount = Math.max(0, Math.round(fiksa) || 0);
  const now = new Date();
  await prisma.user.update({ where: { id: teacherId }, data: { fiksa: amount } });
  await prisma.teacherSalary.upsert({
    where: { teacherId_year_month: { teacherId, year: now.getFullYear(), month: now.getMonth() + 1 } },
    create: { teacherId, year: now.getFullYear(), month: now.getMonth() + 1, fiksa: amount },
    update: { fiksa: amount },
  });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "TeacherSalary", entityId: teacherId, newValue: { fiksa: amount }, reason: "Fiksa o'zgartirildi" });
  revalidatePath("/teachers");
}

export async function updateCurrentSalary(teacherId: string, bonus: number, penalty: number, kpi: number): Promise<void> {
  const s = await requireSession();
  if (!canManage(s.role)) return;
  const now = new Date();
  const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
  const fiksa = teacher?.fiksa ?? 0;
  const b = Math.max(0, Math.round(bonus) || 0);
  const p = Math.max(0, Math.round(penalty) || 0);
  const k = Math.max(0, Math.round(kpi) || 0); // KPI bonus summasi (so'm)
  // KPI bonus = asosiy standart summa (fiksa kabi) — User modelida ham yangilanadi
  await prisma.user.update({ where: { id: teacherId }, data: { kpiBonus: k } });
  await prisma.teacherSalary.upsert({
    where: { teacherId_year_month: { teacherId, year: now.getFullYear(), month: now.getMonth() + 1 } },
    create: { teacherId, year: now.getFullYear(), month: now.getMonth() + 1, fiksa, bonus: b, penalty: p, kpi: k },
    update: { bonus: b, penalty: p, kpi: k },
  });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "TeacherSalary", entityId: teacherId, newValue: { bonus: b, penalty: p, kpi: k }, reason: "Oylik maosh yangilandi" });
  revalidatePath("/teachers");
}
