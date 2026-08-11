"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, type SessionUser } from "@/lib/auth";
import { getPermission, MODULES } from "@/lib/rbac";
import { ROLES } from "@/lib/constants";
import { writeAudit } from "@/lib/audit";
import { isPaymentMandatory, isPaymentMandatoryBulk } from "@/lib/paymentPolicy";

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

// Shu kundagi darsni topadi; bo'lmasa guruh vaqtida yaratadi (davomat uchun)
async function findOrCreateLesson(groupId: string, dateISO: string) {
  const { start, end } = dayRange(dateISO);
  const existing = await prisma.lesson.findFirst({ where: { groupId, startsAt: { gte: start, lt: end } } });
  if (existing) return existing;
  const g = await prisma.group.findUnique({ where: { id: groupId }, select: { startTime: true } });
  const hhmm = g?.startTime && /^\d{2}:\d{2}$/.test(g.startTime) ? g.startTime : "09:00";
  return prisma.lesson.create({ data: { groupId, startsAt: new Date(`${dateISO}T${hhmm}:00`) } });
}

// Shu kundagi davomat holatini olish: { studentId: status }
export async function getGroupAttendance(groupId: string, dateISO: string): Promise<{ ok: boolean; map?: Record<string, string> }> {
  if (!(await canMark(groupId))) return { ok: false };
  const { start, end } = dayRange(dateISO);
  const lesson = await prisma.lesson.findFirst({ where: { groupId, startsAt: { gte: start, lt: end } }, include: { attendances: true } });
  const map: Record<string, string> = {};
  if (lesson) for (const a of lesson.attendances) map[a.studentId] = a.status;
  return { ok: true, map };
}

const ALLOWED = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];
const ATTEND_STATUSES = ["PRESENT", "LATE"]; // "keldi" deb hisoblanadigan holatlar — to'lov bloki shularga tegishli

// Bitta o'quvchining shu kundagi davomatini belgilash (bor/yo'q). Bir xil bosilsa — bekor qilinadi.
// TZ: shu oy 3 (MANDATORY_LESSON_THRESHOLD) dan ko'p dars o'tilgan, lekin to'lov qilinmagan bo'lsa —
// yangi "keldi" belgisi qo'yish bloklanadi (avval to'lov qabul qilinishi kerak).
export async function markStudentAttendance(groupId: string, dateISO: string, studentId: string, status: string): Promise<{ ok: boolean; cleared?: boolean; blocked?: boolean; lessonsThisMonth?: number }> {
  const s = await canMark(groupId);
  if (!s) return { ok: false };
  if (!ALLOWED.includes(status)) return { ok: false };

  const lesson = await findOrCreateLesson(groupId, dateISO);
  const existing = await prisma.attendance.findUnique({ where: { lessonId_studentId: { lessonId: lesson.id, studentId } } });

  // Xuddi shu holat qayta bosilsa — belgini olib tashlaymiz (uchinchi holat: belgisiz) — bu har doim ruxsat
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
export async function markAllPresent(groupId: string, dateISO: string): Promise<{ ok: boolean; added?: number; skippedBlocked?: number }> {
  const s = await canMark(groupId);
  if (!s) return { ok: false };
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
