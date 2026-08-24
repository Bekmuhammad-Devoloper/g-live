"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, type SessionUser } from "@/lib/auth";
import { getPermission, MODULES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { GROUP_FORMATS } from "@/lib/constants";
import { findRoomConflict, conflictLabel } from "./roomConflict";

// FULL huquqli rollar (menejer, dir. o'rinbosari) — guruh/o'quvchi boshqaradi
function hasFullGroups(role: string) {
  return getPermission(role, MODULES.GROUPS) === "FULL";
}

// Guruhni boshqarish huquqi: FULL yoki shu guruh o'qituvchisi
async function canManageGroup(s: SessionUser, groupId: string) {
  if (hasFullGroups(s.role)) return true;
  const g = await prisma.group.findUnique({ where: { id: groupId }, select: { teacherId: true } });
  return !!g && g.teacherId === s.userId;
}

export type FormState = { ok?: boolean; error?: string; detail?: string };

// ─── Guruh yaratish ───
const groupSchema = z.object({
  name: z.string().min(2),
  programId: z.string().min(1),
  teacherId: z.string().optional(),
  levelCode: z.string().optional(),
  color: z.string().optional(),
  format: z.enum(GROUP_FORMATS).optional(),
  onlineLink: z.string().optional(),
  room: z.string().optional(),
  capacity: z.coerce.number().int().positive().max(100),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  weekdays: z.string().optional(), // "1,3,5"
  startTime: z.string().optional(), // "HH:mm"
  endTime: z.string().optional(),
  note: z.string().max(1000).optional(), // izoh/kament
});

// "1,3,5" ni tozalab 1..7 oralig'idagi noyob kunlarni tartiblab qaytaradi
function normalizeWeekdays(raw?: string): string | null {
  if (!raw) return null;
  const days = Array.from(new Set(raw.split(",").map((x) => parseInt(x, 10)).filter((n) => n >= 1 && n <= 7)));
  days.sort((a, b) => a - b);
  return days.length ? days.join(",") : null;
}
const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

// ─── Guruh faol/nofaol holatini almashtirish (on/off toggle) ───
export async function setGroupActive(id: string, active: boolean): Promise<{ ok: boolean; error?: string }> {
  const s = await requireSession();
  if (!hasFullGroups(s.role)) return { ok: false, error: "forbidden" };

  const g = await prisma.group.findUnique({ where: { id }, select: { status: true } });
  if (!g) return { ok: false, error: "notfound" };

  const status = active ? "ACTIVE" : "PLANNED";
  await prisma.group.update({ where: { id }, data: { status } });
  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "Group",
    entityId: id,
    oldValue: { status: g.status },
    newValue: { status },
    reason: active ? "Guruh faollashtirildi" : "Guruh nofaol qilindi",
  });
  revalidatePath("/groups");
  return { ok: true };
}

// ─── Guruhni o'chirish ───
export async function deleteGroup(id: string): Promise<{ ok: boolean; error?: string }> {
  const s = await requireSession();
  if (!hasFullGroups(s.role)) return { ok: false, error: "forbidden" };

  const g = await prisma.group.findUnique({ where: { id }, select: { name: true } });
  if (!g) return { ok: false, error: "notfound" };

  try {
    // GroupStudent/Lesson/Assignment — Cascade; Task/SeasonalAssessment — SetNull
    await prisma.group.delete({ where: { id } });
  } catch {
    return { ok: false, error: "delete_failed" };
  }

  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "Group", entityId: id, oldValue: { name: g.name }, reason: "Guruh o'chirildi" });
  revalidatePath("/groups");
  return { ok: true };
}

export async function createGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireSession();
  if (!hasFullGroups(s.role)) return { error: "forbidden" };

  const parsed = groupSchema.safeParse({
    name: formData.get("name"),
    programId: formData.get("programId"),
    teacherId: formData.get("teacherId") || undefined,
    levelCode: formData.get("levelCode") || undefined,
    color: formData.get("color") || undefined,
    format: formData.get("format") || undefined,
    onlineLink: formData.get("onlineLink") || undefined,
    room: formData.get("room") || undefined,
    capacity: formData.get("capacity") || 12,
    startDate: formData.get("startDate") || undefined,
    endDate: formData.get("endDate") || undefined,
    weekdays: formData.get("weekdays") || undefined,
    startTime: formData.get("startTime") || undefined,
    endTime: formData.get("endTime") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  const startTime = parsed.data.startTime && timeRe.test(parsed.data.startTime) ? parsed.data.startTime : null;
  const endTime = parsed.data.endTime && timeRe.test(parsed.data.endTime) ? parsed.data.endTime : null;
  const weekdays = normalizeWeekdays(parsed.data.weekdays);
  const room = parsed.data.room || null;
  const format = parsed.data.format ?? "OFFLINE";

  // Oflayn/gibrid guruh to'liq jadvalga ega bo'lishi shart (xona bandligini tekshirish uchun)
  if (format !== "ONLINE") {
    if (!room) return { error: "room_required" };
    if (!weekdays || !startTime || !endTime) return { error: "schedule_required" };
    if (startTime >= endTime) return { error: "bad_time" };
  }

  // Xona bandligi: bir xonada vaqti kesishadigan guruh bo'lsa — taqiqlanadi
  const conflict = await findRoomConflict({ room, weekdays, startTime, endTime, branchId: s.branchId });
  if (conflict) return { error: "room_conflict", detail: conflictLabel(conflict) };

  const g = await prisma.group.create({
    data: {
      name: parsed.data.name,
      programId: parsed.data.programId,
      teacherId: parsed.data.teacherId || null,
      levelCode: parsed.data.levelCode || null,
      color: /^#[0-9a-fA-F]{6}$/.test(parsed.data.color ?? "") ? parsed.data.color : null,
      format,
      onlineLink: parsed.data.onlineLink || null,
      room,
      capacity: parsed.data.capacity,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      weekdays,
      startTime,
      endTime,
      note: parsed.data.note?.trim() || null,
      branchId: s.branchId,
      status: "ACTIVE",
    },
  });
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "Group", entityId: g.id, newValue: { name: g.name } });
  revalidatePath("/groups");
  return { ok: true };
}

// ─── Yangi o'quvchi yaratib guruhga biriktirish ───
const studentSchema = z.object({
  groupId: z.string().min(1),
  fullName: z.string().min(2),
  phone: z.string().optional(),
});

export async function createStudentInGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireSession();
  if (!hasFullGroups(s.role)) return { error: "forbidden" };

  const parsed = studentSchema.safeParse({
    groupId: formData.get("groupId"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  const group = await prisma.group.findUnique({ where: { id: parsed.data.groupId } });
  if (!group) return { error: "invalid" };

  // Telefon takrorlanmasin: raqamlar bo'yicha (format farqidan qat'i nazar) tekshiramiz
  const phone = parsed.data.phone?.trim() || null;
  const digits = phone ? phone.replace(/\D/g, "") : "";
  if (digits.length >= 7) {
    const withPhone = await prisma.student.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true } });
    if (withPhone.some((o) => (o.phone ?? "").replace(/\D/g, "") === digits)) return { error: "phone_exists" };
  }

  const student = await prisma.student.create({
    data: {
      fullName: parsed.data.fullName,
      phone: phone,
      branchId: group.branchId,
      currentLevel: group.levelCode,
      eduStatus: "ACTIVE",
    },
  });
  await prisma.groupStudent.create({ data: { groupId: group.id, studentId: student.id } });
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "Student", entityId: student.id, newValue: { fullName: student.fullName, groupId: group.id } });
  revalidatePath(`/groups/${group.id}`);
  return { ok: true };
}

// ─── Mavjud o'quvchini biriktirish ───
// ─── Excel/CSV orqali ko'p o'quvchi qo'shish ───
export async function bulkAddStudents(groupId: string, rows: { name: string; phone: string | null }[]): Promise<{ ok?: boolean; added?: number; error?: string }> {
  const s = await requireSession();
  if (!hasFullGroups(s.role)) return { error: "forbidden" };

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return { error: "invalid" };

  const clean = (rows ?? [])
    .map((r) => ({ name: (r.name || "").trim(), phone: (r.phone || "").trim() || null }))
    .filter((r) => r.name.length >= 2)
    .slice(0, 500);
  if (!clean.length) return { error: "empty" };

  let added = 0;
  for (const r of clean) {
    // Telefon mavjud o'quvchiga mos kelsa — o'shani biriktiramiz (dublikatsiz)
    let studentId: string | null = null;
    if (r.phone) {
      const ex = await prisma.student.findFirst({ where: { phone: r.phone }, select: { id: true } });
      if (ex) studentId = ex.id;
    }
    if (!studentId) {
      const st = await prisma.student.create({
        data: { fullName: r.name, phone: r.phone, branchId: group.branchId, currentLevel: group.levelCode, eduStatus: "ACTIVE" },
      });
      studentId = st.id;
    }
    const already = await prisma.groupStudent.findUnique({ where: { groupId_studentId: { groupId, studentId } } });
    if (!already) { await prisma.groupStudent.create({ data: { groupId, studentId } }); added++; }
  }

  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "GroupStudent", entityId: groupId, newValue: { bulkAdded: added }, reason: "Excel/CSV orqali o'quvchilar qo'shildi" });
  revalidatePath(`/groups/${groupId}`);
  return { ok: true, added };
}

export async function enrollStudent(groupId: string, studentId: string): Promise<void> {
  const s = await requireSession();
  if (!hasFullGroups(s.role)) return;
  const exists = await prisma.groupStudent.findUnique({ where: { groupId_studentId: { groupId, studentId } } });
  if (exists) return;
  await prisma.groupStudent.create({ data: { groupId, studentId } });
  await prisma.student.update({ where: { id: studentId }, data: { eduStatus: "ACTIVE" } });
  revalidatePath(`/groups/${groupId}`);
}

// ─── O'quvchini guruhdan olib tashlash (GroupStudent yozuvini o'chirish) ───
export async function removeStudent(groupId: string, studentId: string): Promise<void> {
  const s = await requireSession();
  if (!hasFullGroups(s.role)) return;
  const res = await prisma.groupStudent.deleteMany({ where: { groupId, studentId } });
  if (res.count > 0) {
    await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "GroupStudent", oldValue: { groupId, studentId } });
  }
  revalidatePath(`/groups/${groupId}`);
}

// ─── Dars yaratish ───
const lessonSchema = z.object({
  groupId: z.string().min(1),
  topic: z.string().optional(),
  startsAt: z.string().min(1),
});

export async function createLesson(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireSession();
  const groupId = String(formData.get("groupId") ?? "");
  if (!(await canManageGroup(s, groupId))) return { error: "forbidden" };

  const parsed = lessonSchema.safeParse({
    groupId,
    topic: formData.get("topic") || undefined,
    startsAt: formData.get("startsAt"),
  });
  if (!parsed.success) return { error: "invalid" };

  const start = new Date(parsed.data.startsAt);
  const lesson = await prisma.lesson.create({
    data: {
      groupId: parsed.data.groupId,
      topic: parsed.data.topic || null,
      startsAt: start,
      endsAt: new Date(start.getTime() + 90 * 60 * 1000),
    },
  });
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "Lesson", entityId: lesson.id, newValue: { topic: lesson.topic } });
  revalidatePath(`/groups/${parsed.data.groupId}`);
  return { ok: true };
}
