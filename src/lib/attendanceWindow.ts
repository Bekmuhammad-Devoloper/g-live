import "server-only";
import { prisma } from "./db";
import { ROLES } from "./constants";

export const GRACE_HOURS = 3;
export const UNLOCK_HOURS = 24;
export const MATERIALIZE_MAX_AGE_DAYS = 7;

const BYPASS_ROLES: string[] = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER, ROLES.ROP];
const UNLOCK_GRANTERS: string[] = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER, ROLES.ROP];

export const canBypassAttendanceLock = (role: string) => BYPASS_ROLES.includes(role);
export const canGrantAttendanceUnlock = (role: string) => UNLOCK_GRANTERS.includes(role);

export interface AttendanceWindow {
  closesAt: Date;
  closed: boolean;
}

const HHMM = /^\d{2}:\d{2}$/;
const T = (dateISO: string, hhmm: string) => new Date(`${dateISO}T${hhmm}:00`);

export function isValidDateISO(dateISO: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return false;
  const d = new Date(dateISO + "T12:00:00");
  if (isNaN(d.getTime())) return false;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` === dateISO;
}

export function todayISOLocal(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function computeAttendanceWindow(
  dateISO: string,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  now: Date = new Date(),
): AttendanceWindow {
  let end: Date;
  if (endTime && HHMM.test(endTime)) {
    end = T(dateISO, endTime);
    if (startTime && HHMM.test(startTime) && end.getTime() <= T(dateISO, startTime).getTime()) {
      end = new Date(end.getTime() + 24 * 3_600_000);
    }
  } else if (startTime && HHMM.test(startTime)) {
    end = new Date(T(dateISO, startTime).getTime() + 90 * 60_000);
  } else {
    end = T(dateISO, "23:59");
  }
  const closesAt = new Date(end.getTime() + GRACE_HOURS * 3_600_000);
  return { closesAt, closed: now.getTime() > closesAt.getTime() };
}

export async function activeUnlockUntil(groupId: string, dateISO: string): Promise<Date | null> {
  const u = await prisma.attendanceUnlock.findFirst({
    where: { groupId, date: dateISO, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "desc" },
    select: { expiresAt: true },
  });
  return u?.expiresAt ?? null;
}

export function isLessonDay(dateISO: string, weekdays: string | null | undefined): boolean {
  if (!weekdays) return false;
  const d = new Date(dateISO + "T12:00:00");
  if (isNaN(d.getTime())) return false;
  const wd = d.getDay() === 0 ? 7 : d.getDay();
  return weekdays.split(",").map(Number).includes(wd);
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function plannedLessonDays(
  year: number,
  month0: number,
  weekdays: string | null | undefined,
  limit: number | null | undefined,
  startDate?: Date | null,
  endDate?: Date | null,
): string[] {
  if (!weekdays) return [];
  const wds = new Set(weekdays.split(",").map(Number));
  const out: string[] = [];
  const last = new Date(year, month0 + 1, 0).getDate();
  for (let day = 1; day <= last; day++) {
    const d = new Date(year, month0, day, 12);
    const wd = d.getDay() === 0 ? 7 : d.getDay();
    if (!wds.has(wd)) continue;
    if (startDate && d < new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())) continue;
    if (endDate && d > new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59)) continue;
    out.push(`${year}-${pad2(month0 + 1)}-${pad2(day)}`);
    if (limit && out.length >= limit) break;
  }
  return out;
}

export function isPlannedLessonDay(
  dateISO: string,
  weekdays: string | null | undefined,
  limit: number | null | undefined,
  startDate?: Date | null,
  endDate?: Date | null,
): boolean {
  if (!weekdays) return true;
  const [y, m] = dateISO.split("-").map(Number);
  if (!y || !m) return false;
  return plannedLessonDays(y, m - 1, weekdays, limit, startDate, endDate).includes(dateISO);
}

export async function lessonLockState(lessonId: string): Promise<{
  closed: boolean;
  unlocked: boolean;
  dateISO: string;
  groupId: string;
} | null> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { startsAt: true, groupId: true, group: { select: { startTime: true, endTime: true } } },
  });
  if (!lesson) return null;
  const dateISO = todayISOLocal(lesson.startsAt);
  const win = computeAttendanceWindow(dateISO, lesson.group.startTime, lesson.group.endTime);
  const unlocked = win.closed ? !!(await activeUnlockUntil(lesson.groupId, dateISO)) : false;
  return { closed: win.closed, unlocked, dateISO, groupId: lesson.groupId };
}
