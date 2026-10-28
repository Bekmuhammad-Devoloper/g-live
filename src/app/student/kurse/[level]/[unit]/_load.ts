import "server-only";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveLevels } from "@/lib/studyLevels";
import { S, type StudentStrings } from "../../../_i18n";
import type { Locale } from "@/lib/constants";
import { groupLessonsWhere } from "@/lib/levelLessons";

const UNITS_PER_CHAPTER = 3;

export interface UnitContext {
  locale: Locale;
  t: StudentStrings;
  code: string;
  levelName: string;
  levelColor: string;
  studentId: string;
  groupId: string;
  lesson: {
    id: string;
    title: string;
    topic: string | null;
    videoUrl: string | null;
    videoPosterUrl: string | null;
    vocabText: string | null;
    vocabFileUrl: string | null;
    assignment: string | null;
    assignmentFileUrl: string | null;
    homework: string | null;
    homeworkFileUrl: string | null;
  };
  unitNo: string;
  unitLabel: string;
  position: number;
  totalInLevel: number;
  prev: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
  taught: boolean;
}

export type UnitLoad = { missing: true } | ({ missing: false } & UnitContext);

export async function loadUnit(level: string, unit: string): Promise<UnitLoad> {
  const code = level.toUpperCase();
  const lvl = (await getActiveLevels()).find((l) => l.code.toUpperCase() === code);
  if (!lvl) notFound();

  const session = await getSession();
  if (!session) redirect("/login");

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      currentLevel: true,
      enrollments: {
        where: { isActive: true },
        orderBy: { joinedAt: "desc" },
        select: { group: { select: { id: true, levelCode: true, programId: true } } },
      },
    },
  });
  if (!student) return { missing: true };

  const group = student.enrollments[0]?.group ?? null;
  if (!group) notFound();

  const [lesson, allLessons, progress] = await Promise.all([
    prisma.courseLesson.findUnique({ where: { id: unit } }),
    prisma.courseLesson.findMany({
      where: await groupLessonsWhere(group),
      orderBy: { order: "asc" },
      select: { id: true, levelCode: true, title: true },
    }),
    prisma.groupLessonProgress.findMany({
      where: { groupId: group.id, taught: true },
      select: { courseLessonId: true },
    }),
  ]);

  if (!lesson || !allLessons.some((l) => l.id === lesson.id)) notFound();

  const fallback = (group.levelCode ?? student.currentLevel ?? "A1").slice(0, 2).toUpperCase();
  const levelLessons = allLessons.filter((l) => (l.levelCode ?? fallback).toUpperCase() === code);
  const idx = levelLessons.findIndex((l) => l.id === lesson.id);
  const position = Math.max(0, idx);
  const chapter = Math.floor(position / UNITS_PER_CHAPTER) + 1;
  const inChapter = (position % UNITS_PER_CHAPTER) + 1;
  const unitNo = `${chapter}.${inChapter}`;

  const levelNameByLocale: Record<string, string> = {
    uz: lvl.nameUz,
    ru: lvl.nameRu,
    en: lvl.nameEn,
    de: lvl.nameDe,
  };

  return {
    missing: false,
    locale: session.locale,
    t: S(session.locale),
    code,
    levelName: levelNameByLocale[session.locale] ?? lvl.nameUz,
    levelColor: lvl.color,
    studentId: student.id,
    groupId: group.id,
    lesson: {
      id: lesson.id,
      title: lesson.title,
      topic: lesson.topic,
      videoUrl: lesson.videoUrl,
      videoPosterUrl: lesson.videoPosterUrl,
      vocabText: lesson.vocabText,
      vocabFileUrl: lesson.vocabFileUrl,
      assignment: lesson.assignment,
      assignmentFileUrl: lesson.assignmentFileUrl,
      homework: lesson.homework,
      homeworkFileUrl: lesson.homeworkFileUrl,
    },
    unitNo,
    unitLabel: `Unit ${unitNo}`,
    position,
    totalInLevel: levelLessons.length,
    prev: idx > 0 ? levelLessons[idx - 1] : null,
    next: idx >= 0 && idx < levelLessons.length - 1 ? levelLessons[idx + 1] : null,
    taught: new Set(progress.map((p) => p.courseLessonId)).has(lesson.id),
  };
}
