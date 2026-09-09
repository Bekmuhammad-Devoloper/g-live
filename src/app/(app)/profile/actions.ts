"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, hashPassword, verifyPassword } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { tr } from "@/lib/tr";

export type Res = { ok?: boolean; error?: string };

// O'z profilini tahrirlash — foydalanuvchi FAQAT o'zinikini o'zgartira oladi.
export async function updateProfile(fd: FormData): Promise<Res> {
  const s = await requireSession();

  const fullName = String(fd.get("fullName") || "").trim();
  const phone = String(fd.get("phone") || "").trim() || null;
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const gender = ["MALE", "FEMALE"].includes(String(fd.get("gender"))) ? String(fd.get("gender")) : null;
  const birthRaw = String(fd.get("birthDate") || "");
  const locale = ["uz", "ru", "en", "de"].includes(String(fd.get("locale"))) ? String(fd.get("locale")) : undefined;
  const imageUrl = String(fd.get("imageUrl") || "").trim() || null;

  if (fullName.length < 3) return { error: tr(s.locale, { uz: "F.I.Sh. kamida 3 ta harf bo'lsin", ru: "Ф.И.О. — не менее 3 букв", en: "Full name must be at least 3 characters", de: "Der Name muss mindestens 3 Zeichen lang sein" }) };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: tr(s.locale, { uz: "Email noto'g'ri", ru: "Неверный email", en: "Invalid email", de: "Ungültige E-Mail" }) };
  if (imageUrl && imageUrl.length > 900_000) return { error: tr(s.locale, { uz: "Rasm hajmi juda katta (max ~900KB)", ru: "Изображение слишком большое (макс. ~900KB)", en: "Image is too large (max ~900KB)", de: "Das Bild ist zu groß (max. ~900KB)" }) };
  if (imageUrl && !/^data:image\/(png|jpe?g|webp|gif);base64,/.test(imageUrl)) return { error: tr(s.locale, { uz: "Rasm formati noto'g'ri", ru: "Неверный формат изображения", en: "Invalid image format", de: "Ungültiges Bildformat" }) };

  // Email band emasligini tekshirish (o'zinikidan boshqa)
  const busy = await prisma.user.findFirst({ where: { email, NOT: { id: s.userId } }, select: { id: true } });
  if (busy) return { error: tr(s.locale, { uz: "Bu email boshqa foydalanuvchida band", ru: "Этот email занят другим пользователем", en: "This email is used by another user", de: "Diese E-Mail wird von einem anderen Benutzer verwendet" }) };

  await prisma.user.update({
    where: { id: s.userId },
    data: {
      fullName, phone, email, gender,
      birthDate: birthRaw ? new Date(birthRaw) : null,
      ...(locale ? { locale } : {}),
      ...(fd.has("imageUrl") ? { imageUrl } : {}),
    },
  });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "User", entityId: s.userId, newValue: { profile: true } });
  revalidatePath("/profile");
  return { ok: true };
}

// Parolni o'zgartirish — joriy parolni tasdiqlash bilan
export async function changePassword(fd: FormData): Promise<Res> {
  const s = await requireSession();
  const current = String(fd.get("current") || "");
  const next = String(fd.get("next") || "");
  const confirm = String(fd.get("confirm") || "");

  if (next.length < 4) return { error: tr(s.locale, { uz: "Yangi parol kamida 4 ta belgi bo'lsin", ru: "Новый пароль должен быть не менее 4 символов", en: "New password must be at least 4 characters", de: "Das neue Passwort muss mindestens 4 Zeichen lang sein" }) };
  if (next !== confirm) return { error: tr(s.locale, { uz: "Yangi parollar mos kelmadi", ru: "Новые пароли не совпадают", en: "New passwords do not match", de: "Die neuen Passwörter stimmen nicht überein" }) };

  const u = await prisma.user.findUnique({ where: { id: s.userId }, select: { passwordHash: true } });
  if (!u) return { error: tr(s.locale, { uz: "Foydalanuvchi topilmadi", ru: "Пользователь не найден", en: "User not found", de: "Benutzer nicht gefunden" }) };
  if (!(await verifyPassword(current, u.passwordHash))) return { error: tr(s.locale, { uz: "Joriy parol noto'g'ri", ru: "Текущий пароль неверный", en: "Current password is incorrect", de: "Das aktuelle Passwort ist falsch" }) };

  await prisma.user.update({
    where: { id: s.userId },
    data: { passwordHash: await hashPassword(next), plainPassword: next },
  });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "User", entityId: s.userId, newValue: { password: "changed" } });
  return { ok: true };
}
