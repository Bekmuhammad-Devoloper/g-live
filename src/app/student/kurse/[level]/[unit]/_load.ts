import "server-only";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveLevels } from "@/lib/studyLevels";
import { S, type StudentStrings } from "../../../_i18n";
import type { Locale } from "@/lib/constants";

// Dars va uning uchta bo'limi (Lug'at · Dars · Vazifa) uchun UMUMIY yuklovchi.
//
// To'rtala sahifada ham bir xil tekshiruvlar bajarilishi kerak: sessiya bormi,
// o'quvchi profili bormi, guruhga biriktirilganmi va so'ralgan dars aynan shu
// guruhning dasturidanmi. Bu tekshiruvlarni har sahifada qayta yozish — ertami
// kechmi bittasini o'tkazib yuborish demakdir, ya'ni boshqa kursning darsini
// URL orqali ochib ko'rish mumkin bo'lib qoladi.

const UNITS_PER_CHAPTER = 3; // Unit 1.1 · 1.2 · 1.3 → keyin 2.1 ...

export interface UnitContext {
  locale: Locale;
  t: StudentStrings;
  /** Daraja kodi (URL dan, katta harfda) */
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
    /** Lug'at, ustoz qo'lda yozgan: "der Hund - it" */
    vocabText: string | null;
    /** Lug'at fayli (pdf/word/txt) — "Lug'at" bo'limida ochiladi */
    vocabFileUrl: string | null;
    assignment: string | null;
    assignmentFileUrl: string | null;
    homework: string | null;
    homeworkFileUrl: string | null;
  };
  /** "1.2" */
  unitNo: string;
  /** "Unit 1.2" */
  unitLabel: string;
  /** Shu darajadagi dars tartibi, 0 dan */
  position: number;
  totalInLevel: number;
  prev: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
  /** Guruhda bu dars o'tilgan deb belgilanganmi */
  taught: boolean;
}

/** O'quvchi profili biriktirilmagan bo'lsa sahifa MissingStudent ko'rsatadi */
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
      where: { programId: group.programId },
      orderBy: { order: "asc" },
      select: { id: true, levelCode: true, title: true },
    }),
    prisma.groupLessonProgress.findMany({
      where: { groupId: group.id, taught: true },
      select: { courseLessonId: true },
    }),
  ]);

  // Boshqa kursning darsiga URL orqali kirib bo'lmasin
  if (!lesson || lesson.programId !== group.programId) notFound();

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
