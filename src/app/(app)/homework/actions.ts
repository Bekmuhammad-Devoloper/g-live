"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, type SessionUser } from "@/lib/auth";
import { getPermission, MODULES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";

export type FormState = { ok?: boolean; error?: string };

async function canManageGroupOf(s: SessionUser, groupId: string) {
  if (getPermission(s.role, MODULES.HOMEWORK) === "FULL") return true;
  const g = await prisma.group.findUnique({ where: { id: groupId }, select: { teacherId: true } });
  return !!g && g.teacherId === s.userId;
}

// ─── Vazifa yaratish (o'qituvchi) ───
const createSchema = z.object({
  groupId: z.string().min(1),
  title: z.string().min(2),
  type: z.string().min(1),
  skill: z.string().optional(),
  maxScore: z.coerce.number().int().positive().max(1000),
  dueAt: z.string().optional(),
  // Vazifa darsga bog'langan bo'lsa — o'quvchi ilovasida shu dars ichida chiqadi
  courseLessonId: z.string().optional(),
});

export async function createAssignment(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireSession();
  const groupId = String(formData.get("groupId") ?? "");
  if (!(await canManageGroupOf(s, groupId))) return { error: "forbidden" };

  const parsed = createSchema.safeParse({
    groupId,
    title: formData.get("title"),
    type: formData.get("type") || "TEXT",
    skill: formData.get("skill") || undefined,
    maxScore: formData.get("maxScore") || 100,
    dueAt: formData.get("dueAt") || undefined,
    courseLessonId: formData.get("courseLessonId") || undefined,
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
      courseLessonId: parsed.data.courseLessonId || null,
    },
  });

  // O'quvchilarga bildirishnoma (TZ 4.11 — yangi vazifa)
  const members = await prisma.groupStudent.findMany({
    where: { groupId: parsed.data.groupId, isActive: true },
    include: { student: true },
  });
  for (const m of members) {
    if (m.student.userId) await notify({ userId: m.student.userId, title: "Yangi vazifa", body: a.title, event: "new_assignment" });
  }

  revalidatePath("/homework");
  revalidatePath("/student", "layout");
  return { ok: true };
}

// ─── O'quvchi vazifani topshiradi ───
export async function submitAssignment(assignmentId: string, content: string, fileUrl?: string | null): Promise<FormState> {
  const s = await requireSession();
  const student = await prisma.student.findUnique({ where: { userId: s.userId } });
  if (!student) return { error: "forbidden" };
  const file = (fileUrl ?? "").trim();
  if (file && !/^\/uploads\/[\w.-]+$/.test(file)) return { error: "invalid" };
  // Matn yoki fayl — kamida bittasi bo'lsin
  if (!content.trim() && !file) return { error: "invalid" };
  if (content.length > 20_000) return { error: "invalid" }; // cheksiz matn bazaga yozilmasin

  // Topshiriq mavjudligini VA o'quvchi o'sha guruhning faol a'zosi ekanini tekshirish.
  // Aks holda istalgan o'quvchi begona guruh topshirig'iga javob yoza olardi
  // (action to'g'ridan-to'g'ri POST qilinishi mumkin — UI filtriga ishonib bo'lmaydi).
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { groupId: true },
  });
  if (!assignment) return { error: "not_found" };
  const member = await prisma.groupStudent.findFirst({
    where: { groupId: assignment.groupId, studentId: student.id, isActive: true },
    select: { id: true },
  });
  if (!member) return { error: "forbidden" };

  // Oldingi urinishlar soni
  const prev = await prisma.submission.count({ where: { assignmentId, studentId: student.id } });
  await prisma.submission.create({
    data: {
      assignmentId,
      studentId: student.id,
      content: content.trim() || null,
      fileUrl: file || null,
      attempt: prev + 1,
      status: "SUBMITTED",
    },
  });
  revalidatePath(`/homework/${assignmentId}`);
  revalidatePath("/student", "layout");
  return { ok: true };
}

// ─── O'qituvchi baholaydi — past bahoga izoh majburiy (FR-HW-05) ───
export async function gradeSubmission(submissionId: string, score: number, note: string): Promise<FormState> {
  const s = await requireSession();
  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { assignment: { include: { group: true } } },
  });
  if (!sub) return { error: "invalid" };
  if (!(await canManageGroupOf(s, sub.assignment.groupId))) return { error: "forbidden" };

  const max = sub.assignment.maxScore;
  const clamped = Math.max(0, Math.min(score, max));
  // Belgilangan chegaradan past baho (60%) izohsiz saqlanmaydi
  if (clamped < max * 0.6 && (!note || note.trim().length < 3)) return { error: "note_required" };

  await prisma.submission.update({
    where: { id: submissionId },
    data: { score: clamped, teacherNote: note?.trim() || null, status: "GRADED", gradedAt: new Date(), gradedById: s.userId },
  });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Submission", entityId: submissionId, newValue: { score: clamped } });
  revalidatePath("/student", "layout");

  const student = await prisma.student.findUnique({ where: { id: sub.studentId } });
  if (student?.userId) await notify({ userId: student.userId, title: "Vazifa baholandi", body: `${sub.assignment.title}: ${clamped}/${max}`, event: "graded" });

  revalidatePath(`/homework/${sub.assignmentId}`);
  return { ok: true };
}
