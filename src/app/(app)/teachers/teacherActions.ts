"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, hashPassword } from "@/lib/auth";
import { ROLES, parseMoney } from "@/lib/constants";
import { writeAudit } from "@/lib/audit";
import { tr } from "@/lib/tr";

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
  if (!canManage(s.role)) return { ok: false, error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };

  const fullName = (input.fullName || "").trim();
  const email = (input.email || "").trim().toLowerCase();
  const phone = (input.phone || "").trim() || null;
  const password = input.password || "";
  const branchId = input.branchId || null;
  // Yuqori chegara SHART (Int'ga sig'maydigan qiymat sahifani yiqitadi — 2026-09-11)
  const fiksa = parseMoney(input.fiksa || 0);
  const kpiBonus = parseMoney(input.kpiBonus ?? 200000);
  if (fiksa === null || kpiBonus === null) return { ok: false, error: tr(s.locale, { uz: "Summa juda katta (eng ko'pi 1 mlrd so'm) — nollar sonini tekshiring", ru: "Сумма слишком велика (макс. 1 млрд сум) — проверьте количество нулей", en: "Amount too large (max 1 billion) — check the number of zeros", de: "Betrag zu groß (max. 1 Mrd.) — Anzahl der Nullen prüfen" }) };
  const gender = input.gender === "MALE" || input.gender === "FEMALE" ? input.gender : null;

  if (fullName.length < 3) return { ok: false, error: tr(s.locale, { uz: "Ism-familiya kamida 3 ta harf bo'lsin", ru: "Имя и фамилия — не менее 3 букв", en: "Full name must be at least 3 characters", de: "Der Name muss mindestens 3 Zeichen lang sein" }) };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: tr(s.locale, { uz: "Email noto'g'ri kiritildi", ru: "Email введён неверно", en: "Invalid email address", de: "Ungültige E-Mail-Adresse" }) };
  if (password.length < 4) return { ok: false, error: tr(s.locale, { uz: "Parol kamida 4 ta belgi bo'lsin", ru: "Пароль должен быть не менее 4 символов", en: "Password must be at least 4 characters", de: "Das Passwort muss mindestens 4 Zeichen lang sein" }) };

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { ok: false, error: tr(s.locale, { uz: "Bu email allaqachon ro'yxatdan o'tgan", ru: "Этот email уже зарегистрирован", en: "This email is already registered", de: "Diese E-Mail ist bereits registriert" }) };

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
  if (!canManage(s.role)) return { ok: false, error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };

  let value: string | null = null;
  if (dataUrl) {
    if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(dataUrl)) return { ok: false, error: tr(s.locale, { uz: "Rasm formati noto'g'ri", ru: "Неверный формат изображения", en: "Invalid image format", de: "Ungültiges Bildformat" }) };
    if (dataUrl.length > 900_000) return { ok: false, error: tr(s.locale, { uz: "Rasm hajmi juda katta", ru: "Изображение слишком большое", en: "Image is too large", de: "Das Bild ist zu groß" }) };
    value = dataUrl;
  }

  const t = await prisma.user.findUnique({ where: { id: teacherId }, select: { role: true } });
  if (!t || t.role !== ROLES.TEACHER) return { ok: false, error: tr(s.locale, { uz: "O'qituvchi topilmadi", ru: "Преподаватель не найден", en: "Teacher not found", de: "Lehrer nicht gefunden" }) };

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
  if (!canManage(s.role)) return { ok: false, error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };
  const t = await prisma.user.findUnique({ where: { id: teacherId }, select: { role: true, email: true, plainPassword: true } });
  if (!t || t.role !== ROLES.TEACHER) return { ok: false, error: tr(s.locale, { uz: "O'qituvchi topilmadi", ru: "Преподаватель не найден", en: "Teacher not found", de: "Lehrer nicht gefunden" }) };
  return { ok: true, email: t.email, password: t.plainPassword };
}

// Parolni yangilash — passwordHash (kirish uchun) + plainPassword (ko'rish uchun) ikkalasi yangilanadi. Rahbariyat.
export async function setTeacherPassword(teacherId: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const s = await requireSession();
  if (!canManage(s.role)) return { ok: false, error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };
  const pw = (newPassword || "").trim();
  if (pw.length < 4) return { ok: false, error: tr(s.locale, { uz: "Parol kamida 4 ta belgi bo'lsin", ru: "Пароль должен быть не менее 4 символов", en: "Password must be at least 4 characters", de: "Das Passwort muss mindestens 4 Zeichen lang sein" }) };
  const t = await prisma.user.findUnique({ where: { id: teacherId }, select: { role: true } });
  if (!t || t.role !== ROLES.TEACHER) return { ok: false, error: tr(s.locale, { uz: "O'qituvchi topilmadi", ru: "Преподаватель не найден", en: "Teacher not found", de: "Lehrer nicht gefunden" }) };
  const passwordHash = await hashPassword(pw);
  await prisma.user.update({ where: { id: teacherId }, data: { passwordHash, plainPassword: pw } });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "User", entityId: teacherId, reason: "O'qituvchi paroli yangilandi" });
  return { ok: true };
}
