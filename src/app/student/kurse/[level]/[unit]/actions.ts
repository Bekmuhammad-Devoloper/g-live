"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { lessonVocabText, parseLessonWords, practicableWords } from "@/lib/lessonWords";
import { awardSkill } from "@/lib/skills";
import { lessonVisibleToGroups } from "@/lib/levelLessons";

export async function markLessonWatched(lessonId: string): Promise<{ ok?: boolean; error?: string }> {
  const s = await getSession();
  if (!s || s.role !== ROLES.STUDENT) return { error: "forbidden" };

  const student = await prisma.student.findUnique({
    where: { userId: s.userId },
    select: {
      id: true,
      enrollments: {
        where: { isActive: true },
        select: { group: { select: { programId: true, levelCode: true } } },
      },
    },
  });
  if (!student) return { error: "forbidden" };

  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    select: { id: true, programId: true },
  });
  if (!lesson) return { error: "invalid" };
  if (!(await lessonVisibleToGroups(lesson.id, student.enrollments.map((e) => e.group)))) return { error: "forbidden" };

  await prisma.lessonView.upsert({
    where: { studentId_courseLessonId: { studentId: student.id, courseLessonId: lesson.id } },
    create: { studentId: student.id, courseLessonId: lesson.id },
    update: {},
  });

  await awardSkill(student.id, "lessonView", `view:${lesson.id}`);

  revalidatePath("/student", "layout");
  return { ok: true };
}

export async function recordVocabStage(lessonId: string, stage: number): Promise<{ ok?: boolean; error?: string }> {
  const s = await getSession();
  if (!s || s.role !== ROLES.STUDENT) return { error: "forbidden" };
  if (![1, 2, 3, 4].includes(stage)) return { error: "invalid" };

  const student = await prisma.student.findUnique({
    where: { userId: s.userId },
    select: { id: true, enrollments: { where: { isActive: true }, select: { group: { select: { programId: true, levelCode: true } } } } },
  });
  if (!student) return { error: "forbidden" };

  const lesson = await prisma.courseLesson.findUnique({ where: { id: lessonId }, select: { id: true, programId: true } });
  if (!lesson) return { error: "invalid" };
  if (!(await lessonVisibleToGroups(lesson.id, student.enrollments.map((e) => e.group)))) return { error: "forbidden" };

  const type = (["vocabStage1", "vocabStage2", "vocabStage3", "vocabStage4"] as const)[stage - 1];
  await awardSkill(student.id, type, `vocab:${lesson.id}:s${stage}`);

  revalidatePath("/student", "layout");
  return { ok: true };
}

export async function markVocabMastered(lessonId: string): Promise<{ ok?: boolean; error?: string }> {
  const s = await getSession();
  if (!s || s.role !== ROLES.STUDENT) return { error: "forbidden" };

  const student = await prisma.student.findUnique({
    where: { userId: s.userId },
    select: {
      id: true,
      enrollments: {
        where: { isActive: true },
        select: { group: { select: { programId: true, levelCode: true } } },
      },
    },
  });
  if (!student) return { error: "forbidden" };

  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    select: { id: true, programId: true, topic: true, vocabText: true },
  });
  if (!lesson) return { error: "invalid" };
  if (!(await lessonVisibleToGroups(lesson.id, student.enrollments.map((e) => e.group)))) return { error: "forbidden" };

  const words = practicableWords(parseLessonWords(lessonVocabText(lesson)));
  if (words.length < 2) return { error: "invalid" };

  await prisma.vocabMastery.upsert({
    where: { studentId_courseLessonId: { studentId: student.id, courseLessonId: lesson.id } },
    create: { studentId: student.id, courseLessonId: lesson.id, words: words.length },
    update: { words: words.length },
  });

  revalidatePath("/student", "layout");
  return { ok: true };
}
