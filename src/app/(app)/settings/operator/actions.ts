"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, createSession } from "@/lib/auth";
import { ROLES, type Locale } from "@/lib/constants";
import { setSetting } from "@/lib/settings";
import { writeAudit } from "@/lib/audit";
import { AUTO_LOGOUT_OPTIONS, prefsKey, type OperatorPrefs } from "./prefs";

const ALLOWED: string[] = [ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN];

export type Res = { ok?: boolean; error?: string };

// Bildirishnoma + avtomatik chiqish sozlamalari — Setting jadvaliga (o'z hisobiga).
export async function saveOperatorPrefs(fd: FormData): Promise<Res> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role)) return { error: "Ruxsat yo'q" };

  const mins = Number(fd.get("autoLogoutMinutes"));
  if (!AUTO_LOGOUT_OPTIONS.includes(mins)) return { error: "Vaqt qiymati noto'g'ri" };

  const prefs: OperatorPrefs = {
    notifyEmail: fd.get("notifyEmail") === "1",
    notifyPush: fd.get("notifyPush") === "1",
    notifySound: fd.get("notifySound") === "1",
    autoLogoutMinutes: mins,
  };

  await setSetting(prefsKey(s.userId), JSON.stringify(prefs));
  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "Setting",
    entityId: prefsKey(s.userId),
    newValue: prefs,
  });
  revalidatePath("/settings/operator");
  return { ok: true };
}

// Interfeys tili — User.locale. Sessiya cookie'si ham yangilanadi,
// shuning uchun til qayta kirmasdan darhol qo'llanadi.
export async function saveOperatorLocale(fd: FormData): Promise<Res> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role)) return { error: "Ruxsat yo'q" };

  const locale = String(fd.get("locale") || "");
  if (!["uz", "ru", "en", "de"].includes(locale)) return { error: "Til noto'g'ri" };

  await prisma.user.update({ where: { id: s.userId }, data: { locale } });
  await createSession({ ...s, locale: locale as Locale });
  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "User",
    entityId: s.userId,
    newValue: { locale },
  });
  revalidatePath("/settings/operator");
  return { ok: true };
}
