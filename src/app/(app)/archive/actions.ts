"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { setSetting } from "@/lib/settings";
import { writeAudit } from "@/lib/audit";

const ALLOWED = [ROLES.DIRECTOR, ROLES.ADMIN, ROLES.DEPUTY_DIRECTOR];
const can = (r: string) => ALLOWED.includes(r as never);

export type Res = { ok?: boolean; error?: string; count?: number; failed?: number };

// Qayta tiklash — foydalanuvchini faollashtiradi
export async function restoreUsers(ids: string[]): Promise<Res> {
  const s = await requireSession();
  if (!can(s.role)) return { error: "Ruxsat yo'q" };
  if (ids.length === 0) return { error: "Hech kim tanlanmagan" };
  await prisma.user.updateMany({ where: { id: { in: ids } }, data: { isActive: true, archivedAt: null, archiveReason: null } });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "User", newValue: { restored: ids.length } });
  revalidatePath("/archive");
  revalidatePath("/settings/staff");
  return { ok: true, count: ids.length };
}

// Butunlay o'chirish — bog'liq ma'lumotlari borlarni o'chirib bo'lmaydi (FK), ular failed ga tushadi
export async function deleteUsersPermanent(ids: string[]): Promise<Res> {
  const s = await requireSession();
  if (!can(s.role)) return { error: "Ruxsat yo'q" };
  if (ids.length === 0) return { error: "Hech kim tanlanmagan" };
  let count = 0, failed = 0;
  for (const id of ids) {
    if (id === s.userId) { failed++; continue; }
    try { await prisma.user.delete({ where: { id } }); count++; }
    catch { failed++; }
  }
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "User", newValue: { deleted: count } });
  revalidatePath("/archive");
  return { ok: true, count, failed };
}

// Belgilanganlarga ilova ichida xabar
export async function messageUsers(ids: string[], text: string): Promise<Res> {
  const s = await requireSession();
  if (!can(s.role)) return { error: "Ruxsat yo'q" };
  const body = text.trim() || "Sizga xabar bor.";
  if (ids.length === 0) return { error: "Hech kim tanlanmagan" };
  await prisma.notification.createMany({ data: ids.map((userId) => ({ userId, title: "Xabar", body, channel: "APP", event: "message" })) });
  return { ok: true, count: ids.length };
}

// Arxivlash sabablari ro'yxatini saqlash (Setting: archive.reasons = JSON string[])
export async function saveArchiveReasons(list: string[]): Promise<Res> {
  const s = await requireSession();
  if (!can(s.role)) return { error: "Ruxsat yo'q" };
  const clean = Array.from(new Set(list.map((x) => x.trim()).filter(Boolean))).slice(0, 50);
  await setSetting("archive.reasons", JSON.stringify(clean));
  revalidatePath("/archive");
  return { ok: true, count: clean.length };
}
