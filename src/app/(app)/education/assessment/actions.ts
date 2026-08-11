"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { ROLES, SEASONS, ASSESSMENT_STATUSES } from "@/lib/constants";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.TEACHER];

export type FormState = { ok?: boolean; error?: string };

const schema = z.object({
  title: z.string().min(2),
  season: z.enum(SEASONS),
  year: z.coerce.number().int().min(2000).max(2100),
  groupId: z.string().optional(),
  levelCode: z.string().optional(),
  skill: z.string().optional(),
  maxScore: z.coerce.number().int().positive().max(1000),
  passScore: z.coerce.number().int().min(0).max(1000),
  date: z.string().optional(),
  status: z.enum(ASSESSMENT_STATUSES).optional(),
  note: z.string().optional(),
});

export async function createAssessment(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };

  const parsed = schema.safeParse({
    title: formData.get("title"),
    season: formData.get("season"),
    year: formData.get("year"),
    groupId: formData.get("groupId") || undefined,
    levelCode: formData.get("levelCode") || undefined,
    skill: formData.get("skill") || undefined,
    maxScore: formData.get("maxScore") || 100,
    passScore: formData.get("passScore") || 60,
    date: formData.get("date") || undefined,
    status: formData.get("status") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  // O'qituvchi faqat o'z guruhiga baholash biriktira oladi
  if (d.groupId && s.role === ROLES.TEACHER) {
    const g = await prisma.group.findUnique({ where: { id: d.groupId }, select: { teacherId: true } });
    if (!g || g.teacherId !== s.userId) return { error: "forbidden" };
  }

  const created = await prisma.seasonalAssessment.create({
    data: {
      title: d.title,
      season: d.season,
      year: d.year,
      groupId: d.groupId || null,
      levelCode: d.levelCode || null,
      skill: d.skill || null,
      maxScore: d.maxScore,
      passScore: d.passScore,
      date: d.date ? new Date(d.date) : null,
      status: d.status ?? "PLANNED",
      note: d.note || null,
    },
  });
  await writeAudit({
    actorId: s.userId,
    action: "CREATE",
    entityType: "SeasonalAssessment",
    entityId: created.id,
    newValue: { title: created.title, season: created.season, year: created.year },
  });
  revalidatePath("/education/assessment");
  return { ok: true };
}
