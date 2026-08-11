"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, type SessionUser } from "@/lib/auth";
import { getPermission, MODULES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

export type FormState = { ok?: boolean; error?: string };

function hasFullGroups(role: string) {
  return getPermission(role, MODULES.GROUPS) === "FULL";
}

async function canManageGroup(s: SessionUser, groupId: string) {
  if (hasFullGroups(s.role)) return true;
  const g = await prisma.group.findUnique({ where: { id: groupId }, select: { teacherId: true } });
  return !!g && g.teacherId === s.userId;
}

const schema = z.object({
  groupId: z.string().min(1),
  title: z.string().min(2),
  type: z.enum(["TASK", "EXAM", "HOMEWORK", "TEST"]).default("TASK"),
  skill: z.string().optional(),
  maxScore: z.coerce.number().int().positive().max(1000),
  dueAt: z.string().optional(),
  note: z.string().optional(),
});

export async function createAssignment(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireSession();
  const groupId = String(formData.get("groupId") ?? "");
  if (!(await canManageGroup(s, groupId))) return { error: "forbidden" };

  const parsed = schema.safeParse({
    groupId,
    title: formData.get("title"),
    type: formData.get("type") || "TASK",
    skill: formData.get("skill") || undefined,
    maxScore: formData.get("maxScore") || 100,
    dueAt: formData.get("dueAt") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  const a = await prisma.assignment.create({
    data: {
      groupId: parsed.data.groupId,
      title: parsed.data.title,
      type: parsed.data.type,
      skill: parsed.data.skill || null,
      maxScore: parsed.data.maxScore,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      note: parsed.data.note || null,
    },
  });
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "Assignment", entityId: a.id, newValue: { title: a.title, type: a.type } });
  revalidatePath("/assignments");
  return { ok: true };
}
