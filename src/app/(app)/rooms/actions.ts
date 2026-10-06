"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { tr } from "@/lib/tr";
import { ROLES } from "@/lib/constants";
import { writeAudit } from "@/lib/audit";

export type FormState = { ok?: boolean; error?: string };

// Xonalarni boshqaruvchi rollar (ofis resursi): menejer, rahbariyat, admin
const MANAGE_ROLES = [ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN];
function canManage(role: string) {
  return MANAGE_ROLES.includes(role as never);
}

const schema = z.object({
  name: z.string().min(1),
  capacity: z.coerce.number().int().min(0).max(1000),
  note: z.string().optional(),
});

export async function createRoom(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireSession();
  if (!canManage(s.role)) return { error: "forbidden" };

  const parsed = schema.safeParse({
    name: formData.get("name"),
    capacity: formData.get("capacity") || 0,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  const room = await prisma.room.create({
    data: { name: parsed.data.name, capacity: parsed.data.capacity, note: parsed.data.note || null, branchId: s.branchId },
  });
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "Room", entityId: room.id, newValue: { name: room.name } });
  revalidatePath("/rooms");
  return { ok: true };
}

// Yaratish yoki tahrirlash (id bo'lsa — update). Modme uslubidagi drawer shuni ishlatadi.
export async function saveRoom(fd: FormData): Promise<FormState> {
  const s = await requireSession();
  if (!canManage(s.role)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };
  const id = String(fd.get("id") || "");
  const name = String(fd.get("name") || "").trim();
  const capacity = Math.max(0, Math.min(1000, Math.round(Number(fd.get("capacity")) || 0)));
  const noteProvided = fd.has("note");
  const note = String(fd.get("note") || "").trim() || null;
  if (name.length < 1) return { error: tr(s.locale, { uz: "Xona nomini kiriting", ru: "Введите название комнаты", en: "Enter the room name", de: "Raumnamen eingeben" }) };

  if (id) {
    const prev = await prisma.room.findUnique({ where: { id }, select: { name: true, capacity: true, branchId: true } });
    await prisma.room.update({ where: { id }, data: { name, capacity, ...(noteProvided ? { note } : {}) } });
    // CRM'dagi filial vaqt oraliqlari (BranchSlot) xonaga nom bo'yicha bog'langan va yaratilganda
    // xona sig'imini nusxalab oladi. Xona o'zgarsa, shu xonaning oraliqlari ham yangilanadi:
    // nomi doim, sig'imi esa faqat xonanikiga teng (yoki bo'sh) bo'lsa — qo'lda berilgani saqlanadi.
    if (prev?.branchId && (prev.name !== name || prev.capacity !== capacity)) {
      const key = prev.name.trim().toLowerCase();
      const slots = await prisma.branchSlot.findMany({ where: { branchId: prev.branchId }, select: { id: true, room: true, capacity: true } });
      for (const sl of slots.filter((x) => x.room.trim().toLowerCase() === key)) {
        const followsRoom = sl.capacity === null || sl.capacity === prev.capacity;
        await prisma.branchSlot.update({
          where: { id: sl.id },
          data: { room: name, ...(followsRoom ? { capacity: capacity > 0 ? capacity : null } : {}) },
        });
      }
      revalidatePath("/crm");
    }
    await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Room", entityId: id, newValue: { name } });
  } else {
    const room = await prisma.room.create({ data: { name, capacity, note, branchId: s.branchId } });
    await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "Room", entityId: room.id, newValue: { name } });
  }
  revalidatePath("/rooms");
  return { ok: true };
}

export async function deleteRoom(id: string): Promise<void> {
  const s = await requireSession();
  if (!canManage(s.role)) return;
  await prisma.room.update({ where: { id }, data: { isActive: false } }).catch(() => {});
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "Room", entityId: id });
  revalidatePath("/rooms");
}
