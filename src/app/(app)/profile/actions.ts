"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, hashPassword, verifyPassword } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export type Res = { ok?: boolean; error?: string };

// O'z profilini tahrirlash — foydalanuvchi FAQAT o'zinikini o'zgartira oladi.
export async function updateProfile(fd: FormData): Promise<Res> {
  const s = await requireSession();

  const fullName = String(fd.get("fullName") || "").trim();
  const phone = String(fd.get("phone") || "").trim() || null;
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const gender = ["MALE", "FEMALE"].includes(String(fd.get("gender"))) ? String(fd.get("gender")) : null;
  const birthRaw = String(fd.get("birthDate") || "");
  const locale = ["uz", "ru", "en"].includes(String(fd.get("locale"))) ? String(fd.get("locale")) : undefined;
  const imageUrl = String(fd.get("imageUrl") || "").trim() || null;

  if (fullName.length < 3) return { error: "F.I.Sh. kamida 3 ta harf bo'lsin" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Email noto'g'ri" };
  if (imageUrl && imageUrl.length > 900_000) return { error: "Rasm hajmi juda katta (max ~900KB)" };
  if (imageUrl && !/^data:image\/(png|jpe?g|webp|gif);base64,/.test(imageUrl)) return { error: "Rasm formati noto'g'ri" };

  // Email band emasligini tekshirish (o'zinikidan boshqa)
  const busy = await prisma.user.findFirst({ where: { email, NOT: { id: s.userId } }, select: { id: true } });
  if (busy) return { error: "Bu email boshqa foydalanuvchida band" };

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

  if (next.length < 4) return { error: "Yangi parol kamida 4 ta belgi bo'lsin" };
  if (next !== confirm) return { error: "Yangi parollar mos kelmadi" };

  const u = await prisma.user.findUnique({ where: { id: s.userId }, select: { passwordHash: true } });
  if (!u) return { error: "Foydalanuvchi topilmadi" };
  if (!(await verifyPassword(current, u.passwordHash))) return { error: "Joriy parol noto'g'ri" };

  await prisma.user.update({
    where: { id: s.userId },
    data: { passwordHash: await hashPassword(next), plainPassword: next },
  });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "User", entityId: s.userId, newValue: { password: "changed" } });
  return { ok: true };
}
