"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LOCALES, ROLES, type Locale } from "@/lib/constants";

export type Res = { ok?: boolean; error?: string };

// Ilova tilini o'zgartirish — faqat o'z hisobiga ta'sir qiladi.
export async function setLocale(locale: string): Promise<Res> {
  const s = await requireSession();
  if (s.role !== ROLES.STUDENT) return { error: "Ruxsat yo'q" };
  if (!LOCALES.includes(locale as Locale)) return { error: "Noma'lum til" };

  await prisma.user.update({ where: { id: s.userId }, data: { locale } });
  revalidatePath("/student/einstellungen");
  revalidatePath("/student");
  return { ok: true };
}
