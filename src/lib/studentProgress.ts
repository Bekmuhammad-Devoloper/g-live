import "server-only";
import { prisma } from "./db";

// O'quvchining kurs jarayoni — YAGONA hisob.
//
// Ilgari uch ekranda uch xil hisoblanardi:
//   · Boshi ("Sizning natijangiz") — faqat o'qituvchi o'tgan darslar
//   · Kurslar ro'yxati             — faqat o'qituvchi o'tgan darslar
//   · Daraja sahifasi              — o'tilgan + ko'rilgan + topshirilgan
// Shu sabab o'quvchi darslarni to'liq ko'rib chiqqan bo'lsa ham Boshi
// ekranida 0% turardi. Endi uchalasi shu fayldan oladi.

export interface LessonRef {
  id: string;
  order: number;
  levelCode: string | null;
  title: string;
  topic?: string | null;
  videoUrl: string | null;
}

export interface StudentProgress {
  /** Barcha darslar (dastur bo'yicha, tartibda) */
  lessons: LessonRef[];
  /** Dars id -> to'lish foizi (0..100) */
  pctOf: (lessonId: string) => number;
  /** Daraja kodi bo'yicha: nechta dars, nechtasi tugagan, umumiy foiz */
  byLevel: Map<string, { total: number; done: number; pct: number }>;
  /** Butun dastur bo'yicha o'rtacha foiz */
  overallPct: number;
  /** Hali tugallanmagan birinchi dars (yo'q bo'lsa — oxirgisi) */
  currentLesson: LessonRef | null;
  /** Tugallangan darslar soni (butun dastur bo'yicha) */
  doneCount: number;
}

/**
 * Bitta darsning to'lish foizi.
 *
 * Bu ko'rsatkich "SIZNING natijangiz" deb ataladi, shuning uchun u
 * O'QUVCHINING O'Z ishiga qarab hisoblanadi:
 *   · videoni ko'rdimi     — dars videosi bo'lsa
 *   · vazifani topshirdimi — vazifa berilgan bo'lsa
 * Ikkalasi ham yo'q dars (o'quvchi bajaradigan narsa yo'q) — o'qituvchining
 * "o'tildi" belgisiga qarab yopiladi.
 *
 * O'qituvchining belgisi o'quvchining foiziga QO'SHILMAYDI: aks holda
 * darslarni to'liq ko'rib chiqqan o'quvchi ham, ustoz jurnalni to'ldirmaguncha,
 * 100% ga yetolmasdi (aynan shu shikoyat bo'lgan). Guruhning sur'ati
 * alohida ko'rsatiladi — Kurslar sahifasidagi "X / N o'tildi".
 */
export async function getStudentProgress(
  studentId: string,
  group: { id: string; programId: string; levelCode: string | null } | null,
): Promise<StudentProgress> {
  const empty: StudentProgress = {
    lessons: [],
    pctOf: () => 0,
    byLevel: new Map(),
    overallPct: 0,
    currentLesson: null,
    doneCount: 0,
  };
  if (!group) return empty;

  const [lessons, taughtRows, viewRows, assignments] = await Promise.all([
    prisma.courseLesson.findMany({
      where: { programId: group.programId },
      orderBy: { order: "asc" },
      select: { id: true, order: true, levelCode: true, title: true, topic: true, videoUrl: true },
    }),
    prisma.groupLessonProgress.findMany({
      where: { groupId: group.id, taught: true },
      select: { courseLessonId: true },
    }),
    prisma.lessonView.findMany({ where: { studentId }, select: { courseLessonId: true } }),
    prisma.assignment.findMany({
      where: { groupId: group.id, courseLessonId: { not: null } },
      select: {
        courseLessonId: true,
        submissions: { where: { studentId }, select: { id: true }, take: 1 },
      },
    }),
  ]);

  const taught = new Set(taughtRows.map((r) => r.courseLessonId));
  const watched = new Set(viewRows.map((r) => r.courseLessonId));
  const hasTask = new Set<string>();
  const didTask = new Set<string>();
  for (const a of assignments) {
    if (!a.courseLessonId) continue;
    hasTask.add(a.courseLessonId);
    if (a.submissions.length > 0) didTask.add(a.courseLessonId);
  }

  const pcts = new Map<string, number>();
  for (const l of lessons) {
    let total = 0;
    let got = 0;
    if (l.videoUrl) {
      total += 1;
      if (watched.has(l.id)) got += 1;
    }
    if (hasTask.has(l.id)) {
      total += 1;
      if (didTask.has(l.id)) got += 1;
    }
    // O'quvchi bajaradigan narsa yo'q — ustozning belgisiga qaraymiz
    if (total === 0) {
      total = 1;
      got = taught.has(l.id) ? 1 : 0;
    }
    pcts.set(l.id, Math.round((got / total) * 100));
  }

  const pctOf = (id: string) => pcts.get(id) ?? 0;

  // Darajaga biriktirilmagan eski darslar guruhning o'z darajasiga tushadi
  const fallback = (group.levelCode ?? "A1").slice(0, 2).toUpperCase();
  const byLevel = new Map<string, { total: number; done: number; pct: number }>();
  const sums = new Map<string, number>();
  for (const l of lessons) {
    const code = (l.levelCode ?? fallback).toUpperCase();
    const cur = byLevel.get(code) ?? { total: 0, done: 0, pct: 0 };
    const p = pctOf(l.id);
    cur.total += 1;
    if (p >= 100) cur.done += 1;
    byLevel.set(code, cur);
    sums.set(code, (sums.get(code) ?? 0) + p);
  }
  for (const [code, v] of byLevel) {
    v.pct = v.total ? Math.round((sums.get(code) ?? 0) / v.total) : 0;
  }

  const doneCount = lessons.filter((l) => pctOf(l.id) >= 100).length;
  const overallPct = lessons.length
    ? Math.round(lessons.reduce((a, l) => a + pctOf(l.id), 0) / lessons.length)
    : 0;
  const currentLesson = lessons.find((l) => pctOf(l.id) < 100) ?? lessons[lessons.length - 1] ?? null;

  return { lessons, pctOf, byLevel, overallPct, currentLesson, doneCount };
}
