"use server";

import { revalidatePath } from "next/cache";
import { createSession, getSession, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LOCALES, ROLES, type Locale } from "@/lib/constants";

export type Res = { ok?: boolean; error?: string };

// Ilova tilini o'zgartirish — faqat o'z hisobiga ta'sir qiladi.
// Til sessiya tokenida ham saqlanadi, shu sabab bazani yangilash yetmaydi:
// token qayta imzolanmasa, ilova eski tilda qolib ketadi.
export async function setLocale(locale: string): Promise<Res> {
  const s = await requireSession();
  if (s.role !== ROLES.STUDENT) return { error: "Ruxsat yo'q" };
  if (!LOCALES.includes(locale as Locale)) return { error: "Noma'lum til" };

  await prisma.user.update({ where: { id: s.userId }, data: { locale } });

  const fresh = await getSession();
  if (fresh) await createSession({ ...fresh, locale: locale as Locale });

  revalidatePath("/student", "layout");
  return { ok: true };
}
