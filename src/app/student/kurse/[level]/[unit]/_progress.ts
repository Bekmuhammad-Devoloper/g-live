import "server-only";
import { prisma } from "@/lib/db";
import { getPointRules } from "@/lib/coinRules";
import { lessonVocabText, looksLikeVocabulary, parseLessonWords } from "@/lib/lessonWords";
import type { UnitContext } from "./_load";

export interface SectionProgress {
  has: boolean;
  pct: number;
}

export interface UnitProgress {
  vocab: SectionProgress & { words: number; mastered: boolean };
  lesson: SectionProgress & { watched: boolean; hasVideo: boolean };
  homework: SectionProgress & { done: number; total: number };
  reward: {
    viewCoin: number;
    viewStar: number;
    taskCoin: number;
    taskStar: number;
  };
}

export async function loadUnitProgress(ctx: UnitContext): Promise<UnitProgress> {
  const [view, mastery, tasks, coins, stars] = await Promise.all([
    prisma.lessonView.findFirst({
      where: { studentId: ctx.studentId, courseLessonId: ctx.lesson.id },
      select: { id: true },
    }),
    prisma.vocabMastery.findFirst({
      where: { studentId: ctx.studentId, courseLessonId: ctx.lesson.id },
      select: { id: true },
    }),
    prisma.assignment.findMany({
      where: { courseLessonId: ctx.lesson.id, groupId: ctx.groupId },
      select: { id: true, submissions: { where: { studentId: ctx.studentId }, select: { id: true }, take: 1 } },
    }),
    getPointRules("coin"),
    getPointRules("star"),
  ]);

  const words = parseLessonWords(lessonVocabText(ctx.lesson));
  const hasVocab = words.length > 0 && looksLikeVocabulary(words);

  const hasVideo = !!ctx.lesson.videoUrl;
  const watched = !!view;

  const total = tasks.length;
  const done = tasks.filter((a) => a.submissions.length > 0).length;

  return {
    vocab: {
      has: hasVocab,
      words: words.length,
      mastered: !!mastery,
      pct: hasVocab ? (mastery || ctx.taught ? 100 : 0) : 0,
    },
    lesson: {
      has: hasVideo,
      hasVideo,
      watched,
      pct: hasVideo ? (watched ? 100 : 0) : 0,
    },
    homework: {
      has: total > 0,
      done,
      total,
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
    },
    reward: {
      viewCoin: coins.lessonView,
      viewStar: stars.lessonView,
      taskCoin: coins.homework,
      taskStar: stars.homework,
    },
  };
}
