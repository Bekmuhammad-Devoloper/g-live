"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { writeAudit } from "@/lib/audit";

// Administrator faqat o'z filialiga tayinlangan — filiallarni boshqara olmaydi (faqat Direktor/o'rinbosar)
const CAN = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR];
const can = (r: string) => CAN.includes(r as never);

export async function saveBranch(fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!can(s.role)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };
  const id = String(fd.get("id") || "");
  const name = String(fd.get("name") || "").trim();
  const address = String(fd.get("address") || "").trim() || null;
  const phone = String(fd.get("phone") || "").trim() || null;
  const latRaw = Number(fd.get("lat")); const lat = Number.isFinite(latRaw) && latRaw !== 0 ? latRaw : null;
  const lngRaw = Number(fd.get("lng")); const lng = Number.isFinite(lngRaw) && lngRaw !== 0 ? lngRaw : null;
  const radius = Math.max(1, Math.round(Number(fd.get("radius")) || 100));
  const imageUrl = String(fd.get("image") || "").trim() || null;
  if (name.length < 2) return { error: tr(s.locale, { uz: "Nomi kamida 2 ta belgi bo'lsin", ru: "Название должно быть не менее 2 символов", en: "Name must be at least 2 characters", de: "Der Name muss mindestens 2 Zeichen lang sein" }) };
  const data = { name, address, phone, lat, lng, radius, imageUrl };
  if (id) await prisma.branch.update({ where: { id }, data });
  else await prisma.branch.create({ data });
  await writeAudit({ actorId: s.userId, action: id ? "UPDATE" : "CREATE", entityType: "Branch", entityId: id || undefined, newValue: { name } });
  revalidatePath("/branches");
  return { ok: true };
}

export async function deleteBranch(id: string): Promise<void> {
  const s = await requireSession();
  if (!can(s.role)) return;
  // Filialga bog'liq foydalanuvchi/guruh bo'lsa o'chirmaymiz
  const [users, groups] = await Promise.all([
    prisma.user.count({ where: { branchId: id } }),
    prisma.group.count({ where: { branchId: id } }),
  ]);
  if (users > 0 || groups > 0) return;
  await prisma.branch.deleteMany({ where: { id } });
  revalidatePath("/branches");
}
