import "server-only";
import { prisma } from "./db";
import { groupLessonsWhere } from "./levelLessons";

export interface LessonRef {
  id: string;
  order: number;
  levelCode: string | null;
  title: string;
  topic?: string | null;
  videoUrl: string | null;
}

export interface StudentProgress {
  lessons: LessonRef[];
  pctOf: (lessonId: string) => number;
  byLevel: Map<string, { total: number; done: number; pct: number }>;
  overallPct: number;
  currentLesson: LessonRef | null;
  doneCount: number;
}

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
      where: await groupLessonsWhere(group),
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
    if (total === 0) {
      total = 1;
      got = taught.has(l.id) ? 1 : 0;
    }
    pcts.set(l.id, Math.round((got / total) * 100));
  }

  const pctOf = (id: string) => pcts.get(id) ?? 0;

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
