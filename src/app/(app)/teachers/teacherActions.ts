"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, hashPassword } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { writeAudit } from "@/lib/audit";

function canManage(role: string) {
  return [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR].includes(role as never);
}

export interface NewTeacherInput {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  branchId?: string;
  fiksa?: number;
  kpiBonus?: number;
  gender?: "MALE" | "FEMALE";
}

export type CreateTeacherResult = { ok: true; id: string } | { ok: false; error: string };

export async function createTeacher(input: NewTeacherInput): Promise<CreateTeacherResult> {
  const s = await requireSession();
  if (!canManage(s.role)) return { ok: false, error: "Ruxsat yo'q" };

  const fullName = (input.fullName || "").trim();
  const email = (input.email || "").trim().toLowerCase();
  const phone = (input.phone || "").trim() || null;
  const password = input.password || "";
  const branchId = input.branchId || null;
  const fiksa = Math.max(0, Math.round(input.fiksa || 0) || 0);
  const kpiBonus = Math.max(0, Math.round(input.kpiBonus ?? 200000));
  const gender = input.gender === "MALE" || input.gender === "FEMALE" ? input.gender : null;

  if (fullName.length < 3) return { ok: false, error: "Ism-familiya kamida 3 ta harf bo'lsin" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Email noto'g'ri kiritildi" };
  if (password.length < 4) return { ok: false, error: "Parol kamida 4 ta belgi bo'lsin" };

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { ok: false, error: "Bu email allaqachon ro'yxatdan o'tgan" };

  const passwordHash = await hashPassword(password);
  const now = new Date();

  const teacher = await prisma.user.create({
    data: {
      fullName,
      email,
      phone,
      passwordHash,
      plainPassword: password, // rahbariyat ko'rishi uchun ochiq nusxa
      role: ROLES.TEACHER,
      isActive: true,
      fiksa,
      kpiBonus,
      gender,
      branchId,
      // joriy oy uchun maosh yozuvi darhol ochiladi
      salaries: { create: { year: now.getFullYear(), month: now.getMonth() + 1, fiksa, kpi: kpiBonus } },
    },
  });

  await writeAudit({
    actorId: s.userId,
    action: "CREATE",
    entityType: "User",
    entityId: teacher.id,
    newValue: { role: ROLES.TEACHER, fullName, email, branchId, fiksa, gender },
    reason: "Yangi o'qituvchi qo'shildi",
  });

  revalidatePath("/teachers");
  return { ok: true, id: teacher.id };
}

// O'qituvchi profil rasmini o'rnatish/o'chirish (data URL). null → o'chirish.
export async function setTeacherImage(teacherId: string, dataUrl: string | null): Promise<{ ok: boolean; error?: string }> {
  const s = await requireSession();
  if (!canManage(s.role)) return { ok: false, error: "Ruxsat yo'q" };

  let value: string | null = null;
  if (dataUrl) {
    if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(dataUrl)) return { ok: false, error: "Rasm formati noto'g'ri" };
    if (dataUrl.length > 900_000) return { ok: false, error: "Rasm hajmi juda katta" };
    value = dataUrl;
  }

  const t = await prisma.user.findUnique({ where: { id: teacherId }, select: { role: true } });
  if (!t || t.role !== ROLES.TEACHER) return { ok: false, error: "O'qituvchi topilmadi" };

  await prisma.user.update({ where: { id: teacherId }, data: { imageUrl: value } });
  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "User",
    entityId: teacherId,
    newValue: { imageUrl: value ? "(rasm)" : null },
    reason: value ? "O'qituvchi rasmi yuklandi" : "O'qituvchi rasmi o'chirildi",
  });

  revalidatePath("/teachers");
  return { ok: true };
}

// O'qituvchi kirish ma'lumotlari (login + ochiq parol). Faqat rahbariyat.
// Talab bo'yicha olinadi — parol sahifa HTML'iga oldindan yozilmaydi.
export async function getTeacherCredentials(teacherId: string): Promise<{ ok: boolean; email?: string; password?: string | null; error?: string }> {
  const s = await requireSession();
  if (!canManage(s.role)) return { ok: false, error: "Ruxsat yo'q" };
  const t = await prisma.user.findUnique({ where: { id: teacherId }, select: { role: true, email: true, plainPassword: true } });
  if (!t || t.role !== ROLES.TEACHER) return { ok: false, error: "O'qituvchi topilmadi" };
  return { ok: true, email: t.email, password: t.plainPassword };
}

// Parolni yangilash — passwordHash (kirish uchun) + plainPassword (ko'rish uchun) ikkalasi yangilanadi. Rahbariyat.
export async function setTeacherPassword(teacherId: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const s = await requireSession();
  if (!canManage(s.role)) return { ok: false, error: "Ruxsat yo'q" };
  const pw = (newPassword || "").trim();
  if (pw.length < 4) return { ok: false, error: "Parol kamida 4 ta belgi bo'lsin" };
  const t = await prisma.user.findUnique({ where: { id: teacherId }, select: { role: true } });
  if (!t || t.role !== ROLES.TEACHER) return { ok: false, error: "O'qituvchi topilmadi" };
  const passwordHash = await hashPassword(pw);
  await prisma.user.update({ where: { id: teacherId }, data: { passwordHash, plainPassword: pw } });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "User", entityId: teacherId, reason: "O'qituvchi paroli yangilandi" });
  return { ok: true };
}
