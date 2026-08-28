"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { writeAudit } from "@/lib/audit";

// Rollarni boshqarish — faqat direktor va o'rinbosari (administrator emas)
const CAN = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR];
const can = (r: string) => CAN.includes(r as never);

export async function saveRole(fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!can(s.role)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission" }) };
  const id = String(fd.get("id") || "");
  const name = String(fd.get("name") || "").trim();
  const description = String(fd.get("description") || "").trim() || null;
  const department = String(fd.get("department") || "").trim() || null;
  const bossOnly = fd.get("bossOnly") === "on" || fd.get("bossOnly") === "true";
  const permissions = String(fd.get("permissions") || "").trim() || null;
  if (name.length < 2) return { error: tr(s.locale, { uz: "Nomi kamida 2 ta belgi bo'lsin", ru: "Название должно быть не менее 2 символов", en: "Name must be at least 2 characters" }) };
  const data = { name, description, department, bossOnly, permissions };
  if (id) await prisma.staffRole.update({ where: { id }, data });
  else await prisma.staffRole.create({ data });
  await writeAudit({ actorId: s.userId, action: id ? "UPDATE" : "CREATE", entityType: "StaffRole", entityId: id || undefined, newValue: { name } });
  revalidatePath("/roles");
  return { ok: true };
}

export async function deleteRole(id: string): Promise<void> {
  const s = await requireSession();
  if (!can(s.role)) return;
  await prisma.staffRole.deleteMany({ where: { id } });
  revalidatePath("/roles");
}
