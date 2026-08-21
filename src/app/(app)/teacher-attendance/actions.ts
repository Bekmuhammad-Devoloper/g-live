"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { writeAudit } from "@/lib/audit";

export type FormState = { ok?: boolean; error?: string };

// Ish jadvali va maosh sozlamalari
const CAN = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];
const canManage = (role: string) => CAN.includes(role as never);
// Davomat katakchalari (2026-08-21 talab): faqat menejer/direktor/o'rinbosar
// o'zgartiradi; qolganlar (admin, ustoz) faqat ko'radi. Ustozga ✓ o'zi
// guruhida davomat o'tkazganda avtomatik tushadi (teacherAutoAttendance).
const CAN_ATT = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER];
const canMarkAtt = (role: string) => CAN_ATT.includes(role as never);
const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeWeekdays(raw?: string): string | null {
  if (!raw) return null;
  const d = Array.from(new Set(raw.split(",").map((x) => parseInt(x, 10)).filter((n) => n >= 1 && n <= 7))).sort((a, b) => a - b);
  return d.length ? d.join(",") : null;
}

// ─── Ish jadvali (upsert) ───
const schedSchema = z.object({
  teacherId: z.string().min(1),
  weekdays: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  monthlySalary: z.coerce.number().int().min(0).max(1_000_000_000),
  startedAt: z.string().optional(),
});

export async function saveTeacherSchedule(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireSession();
  if (!canManage(s.role)) return { error: "forbidden" };
  const parsed = schedSchema.safeParse({
    teacherId: formData.get("teacherId"),
    weekdays: formData.get("weekdays") || undefined,
    startTime: formData.get("startTime") || undefined,
    endTime: formData.get("endTime") || undefined,
    monthlySalary: formData.get("monthlySalary") || 0,
    startedAt: formData.get("startedAt") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  const data = {
    weekdays: normalizeWeekdays(parsed.data.weekdays),
    startTime: parsed.data.startTime && timeRe.test(parsed.data.startTime) ? parsed.data.startTime : null,
    endTime: parsed.data.endTime && timeRe.test(parsed.data.endTime) ? parsed.data.endTime : null,
    monthlySalary: parsed.data.monthlySalary,
    startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : null,
  };
  await prisma.teacherSchedule.upsert({
    where: { teacherId: parsed.data.teacherId },
    create: { teacherId: parsed.data.teacherId, ...data },
    update: data,
  });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "TeacherSchedule", entityId: parsed.data.teacherId, newValue: data });
  revalidatePath("/teacher-attendance");
  return { ok: true };
}

export async function deleteTeacherSchedule(teacherId: string): Promise<void> {
  const s = await requireSession();
  if (!canManage(s.role)) return;
  await prisma.teacherSchedule.deleteMany({ where: { teacherId } });
  revalidatePath("/teacher-attendance");
}

// ─── Kunlik davomat (uch holatli aylanma: yo'q → keldi → kelmadi → yo'q) ───
export async function cycleTeacherAttendance(teacherId: string, dateISO: string): Promise<void> {
  const s = await requireSession();
  if (!canMarkAtt(s.role)) return;
  const date = new Date(dateISO + "T00:00:00");
  const existing = await prisma.teacherAttendance.findUnique({ where: { teacherId_date: { teacherId, date } } });
  if (!existing) {
    await prisma.teacherAttendance.create({ data: { teacherId, date, present: true } });
  } else if (existing.present) {
    await prisma.teacherAttendance.update({ where: { id: existing.id }, data: { present: false } });
  } else {
    await prisma.teacherAttendance.delete({ where: { id: existing.id } });
  }
  revalidatePath("/teacher-attendance");
}
