import "server-only";
import { prisma } from "@/lib/db";
import { plannedLessonDays, todayISOLocal } from "@/lib/attendanceWindow";

export type JournalCell = string;

export interface StudentJournalDay {
  date: string;
  st: JournalCell;
}

export interface StudentJournalGroup {
  id: string;
  name: string;
  course: string;
  teacher: string | null;
  active: boolean;
  days: StudentJournalDay[];
  came: number;
  missed: number;
  excused: number;
  unmarked: number;
  total: number;
}

export interface StudentJournal {
  year: number;
  month0: number;
  today: string;
  groups: StudentJournalGroup[];
}

const ATTENDED = new Set(["PRESENT", "LATE", "ONLINE", "MAKEUP"]);
const HHMM = /^\d{2}:\d{2}$/;
const p2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

export const isValidJournalMonth = (year: number, month0: number) =>
  Number.isInteger(year) && Number.isInteger(month0) && month0 >= 0 && month0 <= 11 && year >= 2000 && year <= 2100;

export function currentJournalMonth(): { year: number; month0: number } {
  const now = new Date();
  return { year: now.getFullYear(), month0: now.getMonth() };
}

export async function loadStudentJournal(studentId: string, year: number, month0: number): Promise<StudentJournal> {
  const monthStart = new Date(year, month0, 1);
  const monthEnd = new Date(year, month0 + 1, 1);
  const firstISO = isoOf(monthStart);
  const lastISO = isoOf(new Date(year, month0 + 1, 0));
  const today = todayISOLocal();

  const [enrollments, marks] = await Promise.all([
    prisma.groupStudent.findMany({
      where: { studentId },
      select: { groupId: true, joinedAt: true, leftAt: true, isActive: true },
    }),
    prisma.attendance.findMany({
      where: { studentId, lesson: { startsAt: { gte: monthStart, lt: monthEnd } } },
      select: { status: true, lesson: { select: { groupId: true, startsAt: true } } },
    }),
  ]);

  const span = new Map<string, { from: string; until: string | null; active: boolean; joinedAt: number }>();
  for (const e of enrollments) {
    const until = e.leftAt
      ? isoOf(e.leftAt)
      : e.isActive ? null : isoOf(new Date(e.joinedAt.getFullYear(), e.joinedAt.getMonth() + 1, 0));
    span.set(e.groupId, { from: isoOf(e.joinedAt), until, active: e.isActive && !e.leftAt, joinedAt: e.joinedAt.getTime() });
  }

  const markMap = new Map<string, Map<string, string>>();
  for (const m of marks) {
    const g = markMap.get(m.lesson.groupId) ?? new Map<string, string>();
    g.set(isoOf(m.lesson.startsAt), m.status);
    markMap.set(m.lesson.groupId, g);
  }

  const groupIds = new Set<string>(markMap.keys());
  for (const [gid, sp] of span) {
    if (sp.from <= lastISO && (sp.until === null || sp.until >= firstISO)) groupIds.add(gid);
  }
  if (groupIds.size === 0) return { year, month0, today, groups: [] };

  const ids = [...groupIds];
  const [groups, lessons] = await Promise.all([
    prisma.group.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, name: true, weekdays: true, startTime: true, startDate: true, endDate: true, lessonsPerMonth: true,
        program: { select: { name: true, lessonsPerMonth: true } },
        teacher: { select: { fullName: true } },
      },
    }),
    prisma.lesson.findMany({
      where: { groupId: { in: ids }, startsAt: { gte: monthStart, lt: monthEnd } },
      select: { groupId: true, startsAt: true },
    }),
  ]);

  const lessonDates = new Map<string, string[]>();
  for (const l of lessons) {
    const arr = lessonDates.get(l.groupId) ?? [];
    arr.push(isoOf(l.startsAt));
    lessonDates.set(l.groupId, arr);
  }

  groups.sort((a, b) => {
    const ra = span.get(a.id), rb = span.get(b.id);
    return Number(!!rb?.active) - Number(!!ra?.active) || (rb?.joinedAt ?? 0) - (ra?.joinedAt ?? 0);
  });

  const nowMs = Date.now();
  const out: StudentJournalGroup[] = groups.map((g) => {
    const sp = span.get(g.id);
    const gm = markMap.get(g.id);
    const planned = plannedLessonDays(year, month0, g.weekdays, g.lessonsPerMonth ?? g.program.lessonsPerMonth, g.startDate, g.endDate);
    const dates = [...new Set([...planned, ...(lessonDates.get(g.id) ?? [])])].sort();

    let came = 0, missed = 0, excused = 0, unmarked = 0, total = 0;
    const days: StudentJournalDay[] = dates.map((date) => {
      const mark = gm?.get(date);
      const member = !!sp && date >= sp.from && (sp.until === null || date <= sp.until);
      const notStarted = date > today
        || (date === today && !!g.startTime && HHMM.test(g.startTime) && new Date(`${date}T${g.startTime}:00`).getTime() > nowMs);
      const st = mark ?? (!member ? "OUT" : notStarted ? "FUTURE" : "UNMARKED");
      if (st !== "OUT") total++;
      if (ATTENDED.has(st)) came++;
      else if (st === "ABSENT") missed++;
      else if (st === "EXCUSED") excused++;
      else if (st === "UNMARKED") unmarked++;
      return { date, st };
    });

    return {
      id: g.id,
      name: g.name,
      course: g.program.name,
      teacher: g.teacher?.fullName ?? null,
      active: !!sp?.active,
      days, came, missed, excused, unmarked, total,
    };
  });

  return { year, month0, today, groups: out };
}
