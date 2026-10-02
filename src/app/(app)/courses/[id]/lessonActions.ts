"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { canEditProgramLessons } from "@/lib/lessonAccess";
import { ROLES } from "@/lib/constants";
import { lessonLinkPath } from "@/lib/lessonLink";

export interface LessonInput {
  title: string;
  levelCode?: string; // qaysi darajaga tegishli (A1, A2, B1 ...)
  topic?: string;
  videoUrl?: string;
  videoPosterUrl?: string; // video banneri (muqova rasmi)
  vocabText?: string; // lug'at, qo'lda yozilgan
  vocabFileUrl?: string; // lug'at fayli (pdf/word/txt)
  materialUrl?: string;
  assignment?: string;
  assignmentFileUrl?: string;
  homework?: string;
  homeworkFileUrl?: string;
}

const clean = (v?: string) => (v && v.trim() ? v.trim() : null);

export async function createCourseLesson(programId: string, input: LessonInput): Promise<{ ok: boolean; error?: string }> {
  const s = await requireSession();
  if (!(await canEditProgramLessons(s, programId))) return { ok: false, error: "forbidden" };
  const title = (input.title || "").trim();
  if (title.length < 1) return { ok: false, error: "invalid" };

  const last = await prisma.courseLesson.findFirst({ where: { programId }, orderBy: { order: "desc" }, select: { order: true } });
  const lesson = await prisma.courseLesson.create({
    data: {
      programId,
      order: (last?.order ?? 0) + 1,
      title,
      levelCode: clean(input.levelCode),
      topic: clean(input.topic),
      videoUrl: clean(input.videoUrl),
      videoPosterUrl: clean(input.videoPosterUrl),
      vocabText: clean(input.vocabText),
      vocabFileUrl: clean(input.vocabFileUrl),
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
  const title = (input.title || "").trim();
  if (title.length < 1) return { ok: false, error: "invalid" };
  const ex = await prisma.courseLesson.findUnique({ where: { id }, select: { programId: true } });
  if (!ex) return { ok: false, error: "invalid" };
  if (!(await canEditProgramLessons(s, ex.programId))) return { ok: false, error: "forbidden" };
  await prisma.courseLesson.update({
    where: { id },
    data: {
      title,
      levelCode: clean(input.levelCode),
      topic: clean(input.topic),
      videoUrl: clean(input.videoUrl),
      videoPosterUrl: clean(input.videoPosterUrl),
      vocabText: clean(input.vocabText),
      vocabFileUrl: clean(input.vocabFileUrl),
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
  const ex = await prisma.courseLesson.findUnique({ where: { id }, select: { programId: true } });
  if (!ex) return { ok: false };
  if (!(await canEditProgramLessons(s, ex.programId))) return { ok: false };
  await prisma.courseLesson.delete({ where: { id } });
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "CourseLesson", entityId: id });
  revalidatePath(`/courses/${ex.programId}`);
  return { ok: true };
}

// Ketma-ketlikni o'zgartirish — qo'shni dars bilan order almashish
export async function moveCourseLesson(id: string, dir: "up" | "down"): Promise<{ ok: boolean }> {
  const s = await requireSession();
  const cur = await prisma.courseLesson.findUnique({ where: { id } });
  if (!cur) return { ok: false };
  if (!(await canEditProgramLessons(s, cur.programId))) return { ok: false };
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

// ─── Dars QR kodi ───
export interface LessonQr {
  url: string;
  /** Modullar satrma-satr ("0"/"1"), uzunligi size*size — BrandedQr chizadi */
  modules: string;
  size: number;
  error?: string;
}

/** Dars havolasi (/l/<id>) uchun QR. Darsni ko'ra oladigan har qanday xodimga ochiq. */
export async function getLessonQr(lessonId: string): Promise<LessonQr> {
  const s = await requireSession();
  const empty = { url: "", modules: "", size: 0 };
  if (s.role === ROLES.STUDENT || s.role === ROLES.PARENT) return { ...empty, error: "forbidden" };
  const lesson = await prisma.courseLesson.findUnique({ where: { id: lessonId }, select: { id: true } });
  if (!lesson) return { ...empty, error: "notfound" };

  const host = (await headers()).get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  const url = `${proto}://${host}${lessonLinkPath(lesson.id)}`;
  try {
    // H — 30% xato tuzatish: markazdagi emblema shu zaxira hisobiga qo'yiladi
    const q = QRCode.create(url, { errorCorrectionLevel: "H" });
    return { url, modules: Array.from(q.modules.data, (b) => (b ? "1" : "0")).join(""), size: q.modules.size };
  } catch {
    return { url, modules: "", size: 0, error: "qr_failed" };
  }
}
