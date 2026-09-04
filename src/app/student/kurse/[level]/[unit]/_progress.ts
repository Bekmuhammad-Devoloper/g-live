import "server-only";
import { prisma } from "@/lib/db";
import { getPointRules } from "@/lib/coinRules";
import { looksLikeVocabulary, parseLessonWords } from "@/lib/lessonWords";
import type { UnitContext } from "./_load";

// Darsning uchta bo'limi bo'yicha jarayon — BITTA joyda hisoblanadi.
//
// Dars sahifasi ham, video ro'yxati ham shu qiymatlarni ko'rsatadi. Agar har
// biri o'zicha hisoblasa, o'quvchi bitta darsda ikki xil foiz ko'rib qolardi.
//
// Har foizning manbasi HAQIQIY va bitta:
//   Lug'at — o'qituvchi darsni o'tgan bo'lsa so'zlar o'tilgan hisoblanadi
//            (alohida "so'z o'rganildi" belgisi tizimda yo'q)
//   Dars   — o'quvchi videoni ko'rgani (LessonView yozuvi)
//   Vazifa — topshirilgan vazifalar ulushi
//
// Bo'lim uchun manba umuman bo'lmasa (masalan video yuklanmagan) — `has:false`
// qaytadi va ekranda foiz o'rniga chiziqcha chiqadi. Aks holda o'quvchi
// o'zi aybdor bo'lmagan holda "0%" ni ko'rib turardi.

export interface SectionProgress {
  /** Bo'lim uchun umuman material bormi */
  has: boolean;
  pct: number;
}

export interface UnitProgress {
  vocab: SectionProgress & { words: number };
  lesson: SectionProgress & { watched: boolean; hasVideo: boolean };
  homework: SectionProgress & { done: number; total: number };
  /** Mukofot qoidalari — video ko'rgani va vazifa uchun */
  reward: {
    viewCoin: number;
    viewStar: number;
    taskCoin: number;
    taskStar: number;
  };
}

export async function loadUnitProgress(ctx: UnitContext): Promise<UnitProgress> {
  const [view, tasks, coins, stars] = await Promise.all([
    prisma.lessonView.findFirst({
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

  const words = parseLessonWords(ctx.lesson.topic);
  const hasVocab = words.length > 0 && looksLikeVocabulary(words);

  const hasVideo = !!ctx.lesson.videoUrl;
  const watched = !!view;

  const total = tasks.length;
  const done = tasks.filter((a) => a.submissions.length > 0).length;

  return {
    vocab: {
      has: hasVocab,
      words: words.length,
      // So'zlar dars o'tilganda o'rganilgan hisoblanadi
      pct: hasVocab ? (ctx.taught ? 100 : 0) : 0,
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
