"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, type SessionUser } from "@/lib/auth";
import { getPermission, MODULES } from "@/lib/rbac";
import { ROLES } from "@/lib/constants";
import { writeAudit } from "@/lib/audit";
import { isPaymentMandatory, isPaymentMandatoryBulk } from "@/lib/paymentPolicy";
import {
  activeUnlockUntil,
  canBypassAttendanceLock,
  canGrantAttendanceUnlock,
  computeAttendanceWindow,
  isLessonDay,
  isValidDateISO,
  todayISOLocal,
  MATERIALIZE_MAX_AGE_DAYS,
  UNLOCK_HOURS,
} from "@/lib/attendanceWindow";

// Davomat belgilash huquqi: FULL (rahbariyat) yoki shu guruh o'qituvchisi
async function canMark(groupId: string): Promise<SessionUser | null> {
  const s = await requireSession();
  if (getPermission(s.role, MODULES.GROUPS) === "FULL") return s;
  if (s.role === ROLES.TEACHER) {
    const g = await prisma.group.findUnique({ where: { id: groupId }, select: { teacherId: true } });
    if (g?.teacherId === s.userId) return s;
  }
  return null;
}

const dayRange = (dateISO: string) => {
  const start = new Date(dateISO + "T00:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const hhmmOf = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const dmOf = (d: Date) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${hhmmOf(d)}`;

// Shu kundagi darsni topadi; bo'lmasa guruh vaqtida yaratadi (davomat uchun)
async function findOrCreateLesson(groupId: string, dateISO: string) {
  const { start, end } = dayRange(dateISO);
  const existing = await prisma.lesson.findFirst({ where: { groupId, startsAt: { gte: start, lt: end } } });
  if (existing) return existing;
  const g = await prisma.group.findUnique({ where: { id: groupId }, select: { startTime: true } });
  const hhmm = g?.startTime && /^\d{2}:\d{2}$/.test(g.startTime) ? g.startTime : "09:00";
  return prisma.lesson.create({ data: { groupId, startsAt: new Date(`${dateISO}T${hhmm}:00`) } });
}

export interface AttendanceWindowInfo {
  /** Oyna yopilganmi (dars tugashi + 3 soat o'tganmi) */
  closed: boolean;
  /** Kelajak sanami (oldindan belgilash taqiqlanadi) */
  future: boolean;
  /** Hozir tahrirlash mumkinmi (ochiq, yoki ruxsat/bypass bor) */
  editable: boolean;
  /** Oyna yopilish vaqti — "14.08 15:00" ko'rinishida (faqat ko'rsatish uchun) */
  closesAtLabel: string;
  /** Amaldagi ruxsat qachongacha ("21.08 15:30") — bo'lmasa null */
  unlockedUntilLabel: string | null;
  /** Joriy foydalanuvchi ruxsat bera oladimi (menejer/direktor/o'rinbosar/ROP) */
  canUnlock: boolean;
}

/**
 * Yopilgan kunda belgilanmaganlarni avtomatik "yo'q" (ABSENT) qilib yozadi.
 * Chegaralar: (1) faqat so'nggi MATERIALIZE_MAX_AGE_DAYS ichidagi kunlar —
 * tarixni varaqlash eski oylarni soxta ABSENT bilan to'ldirmasin; (2) faqat
 * guruhning dars kuni (weekdays yoki mavjud dars yozuvi) va guruh davri ichida;
 * (3) faqat o'sha kunga qadar guruhga QO'SHILGAN o'quvchilar (joinedAt).
 * method="AUTO" — qo'lda belgilangandan farqlash uchun.
 */
async function materializeAutoAbsent(groupId: string, dateISO: string, closesAt: Date): Promise<void> {
  // Juda eski kun — teginmaymiz (belgilanmagan bo'lib qoladi, hisobot buzilmaydi)
  if (Date.now() - closesAt.getTime() > MATERIALIZE_MAX_AGE_DAYS * 86_400_000) return;

  const { start, end } = dayRange(dateISO);
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      weekdays: true, startTime: true, startDate: true, endDate: true,
      students: { where: { isActive: true }, select: { studentId: true, joinedAt: true } },
    },
  });
  if (!group || group.students.length === 0) return;

  const existingLesson = await prisma.lesson.findFirst({ where: { groupId, startsAt: { gte: start, lt: end } }, select: { id: true } });
  if (!existingLesson) {
    // Dars yozuvi yo'q — faqat haqiqiy dars kunida yaratamiz (dam olish kuniga yozmaymiz)
    if (!isLessonDay(dateISO, group.weekdays)) return;
    if (group.startDate && new Date(dateISO + "T23:59:59") < group.startDate) return;
    if (group.endDate && new Date(dateISO + "T00:00:00") > group.endDate) return;
  }

  const lesson = existingLesson ?? (await findOrCreateLesson(groupId, dateISO));
  const marked = await prisma.attendance.findMany({ where: { lessonId: lesson.id }, select: { studentId: true } });
  const markedSet = new Set(marked.map((m) => m.studentId));
  const dayEnd = new Date(dateISO + "T23:59:59");
  const missing = group.students.filter(
    (gs) => !markedSet.has(gs.studentId) && gs.joinedAt.getTime() <= dayEnd.getTime(), // o'sha kuni guruhda bo'lganlargina
  );
  if (missing.length === 0) return;

  await prisma.attendance.createMany({
    data: missing.map((gs) => ({
      lessonId: lesson.id,
      studentId: gs.studentId,
      status: "ABSENT",
      method: "AUTO", // oyna yopilgach avtomatik qo'yilgan
      confirmed: false,
    })),
  });
}

// Shu kundagi davomat holati + oyna ma'lumoti: { studentId: status } va window
export async function getGroupAttendance(
  groupId: string,
  dateISO: string,
): Promise<{ ok: boolean; map?: Record<string, string>; window?: AttendanceWindowInfo }> {
  const s = await canMark(groupId);
  if (!s) return { ok: false };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return { ok: false };

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { startTime: true, endTime: true } });
  const win = computeAttendanceWindow(dateISO, group?.startTime, group?.endTime);
  const unlockUntil = win.closed ? await activeUnlockUntil(groupId, dateISO) : null;

  // Oyna yopilgan va ruxsat ham yo'q — belgilanmaganlar avtomatik "yo'q" bo'ladi
  if (win.closed && !unlockUntil) {
    try { await materializeAutoAbsent(groupId, dateISO); } catch { /* materializatsiya yiqilsa ko'rsatishga xalal bermasin */ }
  }

  const { start, end } = dayRange(dateISO);
  const lesson = await prisma.lesson.findFirst({ where: { groupId, startsAt: { gte: start, lt: end } }, include: { attendances: true } });
  const map: Record<string, string> = {};
  if (lesson) for (const a of lesson.attendances) map[a.studentId] = a.status;

  const editable = !win.closed || !!unlockUntil || canBypassAttendanceLock(s.role);
  return {
    ok: true,
    map,
    window: {
      closed: win.closed,
      editable,
      closesAtLabel: dmOf(win.closesAt),
      unlockedUntilLabel: unlockUntil ? dmOf(unlockUntil) : null,
      canUnlock: canGrantAttendanceUnlock(s.role),
    },
  };
}

/** Yopiq oynada tahrirlashga urinishni tekshiradi: null = mumkin, aks holda sabab. */
async function lockCheck(s: SessionUser, groupId: string, dateISO: string): Promise<{ closed: true; closesAtLabel: string } | null> {
  if (canBypassAttendanceLock(s.role)) return null;
  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { startTime: true, endTime: true } });
  const win = computeAttendanceWindow(dateISO, group?.startTime, group?.endTime);
  if (!win.closed) return null;
  if (await activeUnlockUntil(groupId, dateISO)) return null;
  return { closed: true, closesAtLabel: dmOf(win.closesAt) };
}

const ALLOWED = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];
const ATTEND_STATUSES = ["PRESENT", "LATE"]; // "keldi" deb hisoblanadigan holatlar — to'lov bloki shularga tegishli

// Bitta o'quvchining shu kundagi davomatini belgilash (bor/yo'q). Bir xil bosilsa — bekor qilinadi.
// Qoidalar: (1) yopiq oynada (dars + 3 soat o'tgan) o'qituvchi/admin tahrirlay olmaydi — ruxsat kerak;
// (2) to'lov majburiy bo'lsa yangi "keldi" belgisi bloklanadi.
export async function markStudentAttendance(
  groupId: string,
  dateISO: string,
  studentId: string,
  status: string,
): Promise<{ ok: boolean; cleared?: boolean; blocked?: boolean; lessonsThisMonth?: number; closed?: boolean; closesAtLabel?: string }> {
  const s = await canMark(groupId);
  if (!s) return { ok: false };
  if (!ALLOWED.includes(status)) return { ok: false };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return { ok: false };

  // Yopiq oyna tekshiruvi — belgilash HAM, o'chirish HAM taqiqlanadi (avto-"yo'q"ni o'chirib bo'lmasin)
  const lock = await lockCheck(s, groupId, dateISO);
  if (lock) return { ok: false, ...lock };

  const lesson = await findOrCreateLesson(groupId, dateISO);
  const existing = await prisma.attendance.findUnique({ where: { lessonId_studentId: { lessonId: lesson.id, studentId } } });

  // Xuddi shu holat qayta bosilsa — belgini olib tashlaymiz (uchinchi holat: belgisiz)
  if (existing && existing.status === status) {
    await prisma.attendance.delete({ where: { id: existing.id } });
    revalidatePath(`/groups/${groupId}`);
    return { ok: true, cleared: true };
  }

  // Yangi "keldi" belgisi (avval keldi deb belgilanmagan bo'lsa) — to'lov majburiyligini tekshiramiz
  const wasAlreadyAttending = existing ? ATTEND_STATUSES.includes(existing.status) : false;
  if (ATTEND_STATUSES.includes(status) && !wasAlreadyAttending) {
    const { mandatory, lessonsThisMonth } = await isPaymentMandatory(studentId);
    if (mandatory) return { ok: false, blocked: true, lessonsThisMonth };
  }

  await prisma.attendance.upsert({
    where: { lessonId_studentId: { lessonId: lesson.id, studentId } },
    create: { lessonId: lesson.id, studentId, status, method: "MANUAL", confirmed: true },
    update: { status, method: "MANUAL", confirmed: true, markedAt: new Date() },
  });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Attendance", entityId: lesson.id, newValue: { studentId, status, date: dateISO } });
  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

// Barcha (belgilanmagan) o'quvchilarni bir bosishда "bor" qilish — to'lovi majburiy (bloklangan)larni o'tkazib yuboradi
export async function markAllPresent(
  groupId: string,
  dateISO: string,
): Promise<{ ok: boolean; added?: number; skippedBlocked?: number; closed?: boolean; closesAtLabel?: string }> {
  const s = await canMark(groupId);
  if (!s) return { ok: false };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return { ok: false };

  const lock = await lockCheck(s, groupId, dateISO);
  if (lock) return { ok: false, ...lock };

  const group = await prisma.group.findUnique({ where: { id: groupId }, include: { students: { select: { studentId: true } } } });
  if (!group) return { ok: false };
  const lesson = await findOrCreateLesson(groupId, dateISO);
  const marked = await prisma.attendance.findMany({ where: { lessonId: lesson.id }, select: { studentId: true } });
  const markedSet = new Set(marked.map((m) => m.studentId));
  const toCheck = group.students.map((gs) => gs.studentId).filter((id) => !markedSet.has(id));
  const blockMap = await isPaymentMandatoryBulk(toCheck);
  let added = 0, skippedBlocked = 0;
  for (const gs of group.students) {
    if (markedSet.has(gs.studentId)) continue;
    if (blockMap.get(gs.studentId)?.mandatory) { skippedBlocked++; continue; }
    await prisma.attendance.create({ data: { lessonId: lesson.id, studentId: gs.studentId, status: "PRESENT", method: "MANUAL", confirmed: true } });
    added++;
  }
  revalidatePath(`/groups/${groupId}`);
  return { ok: true, added, skippedBlocked };
}

/**
 * Yopilgan davomatni UNLOCK_HOURS (24 soat) ga ochish — faqat rahbariyat
 * (menejer / direktor / o'rinbosar / ROP). Audit bilan yoziladi.
 */
export async function unlockAttendance(
  groupId: string,
  dateISO: string,
): Promise<{ ok: boolean; untilLabel?: string; error?: string }> {
  const s = await requireSession();
  if (!canGrantAttendanceUnlock(s.role)) return { ok: false, error: "forbidden" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return { ok: false, error: "invalid" };
  const g = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true, name: true } });
  if (!g) return { ok: false, error: "notfound" };

  const expiresAt = new Date(Date.now() + UNLOCK_HOURS * 3_600_000);
  await prisma.attendanceUnlock.create({
    data: { groupId, date: dateISO, expiresAt, grantedById: s.userId, grantedByName: s.fullName ?? null },
  });
  await writeAudit({
    actorId: s.userId,
    action: "CREATE",
    entityType: "AttendanceUnlock",
    entityId: groupId,
    newValue: { date: dateISO, expiresAt: expiresAt.toISOString(), group: g.name },
    reason: `Yopilgan davomat ochildi (${g.name}, ${dateISO}, ${UNLOCK_HOURS} soat)`,
  });
  revalidatePath(`/groups/${groupId}`);
  return { ok: true, untilLabel: dmOf(expiresAt) };
}
