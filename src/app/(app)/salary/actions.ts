"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getPermission, MODULES } from "@/lib/rbac";
import { ROLES } from "@/lib/constants";
import { writeAudit } from "@/lib/audit";

export type FormState = { ok?: boolean; error?: string };

// Faqat FULL huquqli rollar (direktor / o'rinbosar) maosh hisobini yopadi.
function canManageSalary(role: string) {
  return getPermission(role, MODULES.SALARY) === "FULL";
}

const schema = z.object({
  teacherId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  bonus: z.coerce.number().int().min(0).max(1_000_000_000),
  penalty: z.coerce.number().int().min(0).max(1_000_000_000),
  kpi: z.coerce.number().int().min(0).max(1_000_000_000), // KPI bonus summasi (so'm)
  closed: z.coerce.boolean(),
});

// Maosh yozuvini hisoblab saqlash (upsert) — TeacherSalary yozuvi.
// Darslar/o'quvchilar soni serverda snapshot qilinadi; fiksa xodim kartochkasidan olinadi.
export async function saveTeacherSalary(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireSession();
  if (!canManageSalary(s.role)) return { error: "forbidden" };

  const parsed = schema.safeParse({
    teacherId: formData.get("teacherId"),
    year: formData.get("year"),
    month: formData.get("month"),
    bonus: formData.get("bonus") || 0,
    penalty: formData.get("penalty") || 0,
    kpi: formData.get("kpi") || 0,
    closed: formData.get("closed") === "on" || formData.get("closed") === "true",
  });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  const teacher = await prisma.user.findUnique({
    where: { id: d.teacherId },
    select: { id: true, role: true, fiksa: true },
  });
  if (!teacher || teacher.role !== ROLES.TEACHER) return { error: "invalid" };

  // Davr chegaralari
  const monthStart = new Date(d.year, d.month - 1, 1);
  const monthEnd = new Date(d.year, d.month, 1);

  const groups = await prisma.group.findMany({ where: { teacherId: d.teacherId }, select: { id: true } });
  const groupIds = groups.map((g) => g.id);

  const [lessons, students] = await Promise.all([
    groupIds.length
      ? prisma.lesson.count({ where: { groupId: { in: groupIds }, startsAt: { gte: monthStart, lt: monthEnd } } })
      : Promise.resolve(0),
    groupIds.length
      ? prisma.groupStudent.count({ where: { groupId: { in: groupIds }, isActive: true } })
      : Promise.resolve(0),
  ]);

  const existing = await prisma.teacherSalary.findUnique({
    where: { teacherId_year_month: { teacherId: d.teacherId, year: d.year, month: d.month } },
    select: { id: true },
  });

  const row = await prisma.teacherSalary.upsert({
    where: { teacherId_year_month: { teacherId: d.teacherId, year: d.year, month: d.month } },
    create: {
      teacherId: d.teacherId,
      year: d.year,
      month: d.month,
      fiksa: teacher.fiksa,
      bonus: d.bonus,
      penalty: d.penalty,
      kpi: d.kpi,
      lessons,
      students,
      closed: d.closed,
    },
    update: {
      fiksa: teacher.fiksa,
      bonus: d.bonus,
      penalty: d.penalty,
      kpi: d.kpi,
      lessons,
      students,
      closed: d.closed,
    },
  });

  await writeAudit({
    actorId: s.userId,
    action: existing ? "UPDATE" : "CREATE",
    entityType: "TeacherSalary",
    entityId: row.id,
    newValue: { year: d.year, month: d.month, fiksa: teacher.fiksa, bonus: d.bonus, penalty: d.penalty, kpi: d.kpi, net: teacher.fiksa + d.bonus + d.kpi - d.penalty, closed: d.closed },
  });

  revalidatePath("/salary");
  return { ok: true };
}
