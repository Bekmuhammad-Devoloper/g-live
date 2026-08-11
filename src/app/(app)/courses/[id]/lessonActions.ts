"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { writeAudit } from "@/lib/audit";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.TEACHER];
const can = (role: string) => ALLOWED.includes(role as never);

export interface LessonInput {
  title: string;
  topic?: string;
  videoUrl?: string;
  materialUrl?: string;
  assignment?: string;
  assignmentFileUrl?: string;
  homework?: string;
  homeworkFileUrl?: string;
}

const clean = (v?: string) => (v && v.trim() ? v.trim() : null);

export async function createCourseLesson(programId: string, input: LessonInput): Promise<{ ok: boolean; error?: string }> {
  const s = await requireSession();
  if (!can(s.role)) return { ok: false, error: "forbidden" };
  const title = (input.title || "").trim();
  if (title.length < 1) return { ok: false, error: "invalid" };

  const last = await prisma.courseLesson.findFirst({ where: { programId }, orderBy: { order: "desc" }, select: { order: true } });
  const lesson = await prisma.courseLesson.create({
    data: {
      programId,
      order: (last?.order ?? 0) + 1,
      title,
      topic: clean(input.topic),
      videoUrl: clean(input.videoUrl),
      materialUrl: clean(input.materialUrl),
      assignment: clean(input.assignment),
      assignmentFileUrl: clean(input.assignmentFileUrl),
      homework: clean(input.homework),
      homeworkFileUrl: clean(input.homeworkFileUrl),
    },
  });
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "CourseLesson", entityId: lesson.id, newValue: { title } });
  revalidatePath(`/courses/${programId}`);
  return { ok: true };
}

export async function updateCourseLesson(id: string, input: LessonInput): Promise<{ ok: boolean; error?: string }> {
  const s = await requireSession();
  if (!can(s.role)) return { ok: false, error: "forbidden" };
  const title = (input.title || "").trim();
  if (title.length < 1) return { ok: false, error: "invalid" };
  const ex = await prisma.courseLesson.findUnique({ where: { id }, select: { programId: true } });
  if (!ex) return { ok: false, error: "invalid" };
  await prisma.courseLesson.update({
    where: { id },
    data: {
      title,
      topic: clean(input.topic),
      videoUrl: clean(input.videoUrl),
      materialUrl: clean(input.materialUrl),
      assignment: clean(input.assignment),
      assignmentFileUrl: clean(input.assignmentFileUrl),
      homework: clean(input.homework),
      homeworkFileUrl: clean(input.homeworkFileUrl),
    },
  });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "CourseLesson", entityId: id, newValue: { title } });
  revalidatePath(`/courses/${ex.programId}`);
  return { ok: true };
}

export async function deleteCourseLesson(id: string): Promise<{ ok: boolean }> {
  const s = await requireSession();
  if (!can(s.role)) return { ok: false };
  const ex = await prisma.courseLesson.findUnique({ where: { id }, select: { programId: true } });
  if (!ex) return { ok: false };
  await prisma.courseLesson.delete({ where: { id } });
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "CourseLesson", entityId: id });
  revalidatePath(`/courses/${ex.programId}`);
  return { ok: true };
}

// Ketma-ketlikni o'zgartirish — qo'shni dars bilan order almashish
export async function moveCourseLesson(id: string, dir: "up" | "down"): Promise<{ ok: boolean }> {
  const s = await requireSession();
  if (!can(s.role)) return { ok: false };
  const cur = await prisma.courseLesson.findUnique({ where: { id } });
  if (!cur) return { ok: false };
  const neighbor = await prisma.courseLesson.findFirst({
    where: { programId: cur.programId, order: dir === "up" ? { lt: cur.order } : { gt: cur.order } },
    orderBy: { order: dir === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return { ok: true };
  await prisma.$transaction([
    prisma.courseLesson.update({ where: { id: cur.id }, data: { order: neighbor.order } }),
    prisma.courseLesson.update({ where: { id: neighbor.id }, data: { order: cur.order } }),
  ]);
  revalidatePath(`/courses/${cur.programId}`);
  return { ok: true };
}
