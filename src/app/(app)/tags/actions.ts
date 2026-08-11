"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { writeAudit } from "@/lib/audit";

const CAN = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];
const can = (r: string) => CAN.includes(r as never);

export async function saveTag(fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!can(s.role)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission" }) };
  const id = String(fd.get("id") || "");
  const name = String(fd.get("name") || "").trim();
  const code = String(fd.get("code") || "").trim() || null;
  if (name.length < 2) return { error: tr(s.locale, { uz: "Nomi kamida 2 ta belgi bo'lsin", ru: "Название должно быть не менее 2 символов", en: "Name must be at least 2 characters" }) };
  if (id) await prisma.tag.update({ where: { id }, data: { name, code } });
  else await prisma.tag.create({ data: { name, code } });
  await writeAudit({ actorId: s.userId, action: id ? "UPDATE" : "CREATE", entityType: "Tag", entityId: id || undefined, newValue: { name } });
  revalidatePath("/tags");
  return { ok: true };
}

export async function deleteTag(id: string): Promise<void> {
  const s = await requireSession();
  if (!can(s.role)) return;
  await prisma.tag.deleteMany({ where: { id } });
  revalidatePath("/tags");
}
