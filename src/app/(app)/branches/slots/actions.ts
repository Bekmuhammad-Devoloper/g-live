"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { writeAudit } from "@/lib/audit";

/* ─── Filialdagi bo'sh xona / bo'sh vaqt ─────────────────────────────────
   Filial administratori o'z filialiga kiritadi (dashboard), direktor/o'rinbosar
   istalgan filialga. ROP lidlar kanbanidagi filial ustunida ko'radi — lidni
   qaysi filialga, qaysi vaqtga yo'naltirish mumkinligini bilish uchun.       */

export interface VSlot {
  id: string;
  branchId: string;
  room: string;
  days: string;
  startTime: string;
  endTime: string;
  note: string | null;
  /** Xona sig'imi — shundan ortiq lid tashlab bo'lmaydi */
  capacity: number | null;
}

export type SlotResult = { ok?: boolean; error?: string; slots?: VSlot[] };

const HEAD = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR];

/** Kim qaysi filial vaqtlarini tahrirlay oladi: rahbariyat — hammasini, administrator — faqat o'z filialini */
function canEdit(s: { role: string; branchId: string | null }, branchId: string): boolean {
  if (HEAD.includes(s.role as never)) return true;
  return s.role === ROLES.ADMIN && !!s.branchId && s.branchId === branchId;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const toV = (x: { id: string; branchId: string; room: string; days: string; startTime: string; endTime: string; note: string | null; capacity: number | null }): VSlot =>
  ({ id: x.id, branchId: x.branchId, room: x.room, days: x.days, startTime: x.startTime, endTime: x.endTime, note: x.note, capacity: x.capacity });

export async function listBranchSlots(branchId: string): Promise<VSlot[]> {
  await requireSession();
  const rows = await prisma.branchSlot.findMany({ where: { branchId }, orderBy: [{ room: "asc" }, { startTime: "asc" }] });
  return rows.map(toV);
}

/** Filial xonalari — tanlov ro'yxati uchun (Xonalar bo'limidan), sig'imi bilan */
export async function listBranchRooms(branchId: string): Promise<{ name: string; capacity: number }[]> {
  await requireSession();
  const rooms = await prisma.room.findMany({ where: { branchId, isActive: true }, select: { name: true, capacity: true }, orderBy: { name: "asc" } });
  return rooms.map((r) => ({ name: r.name, capacity: r.capacity }));
}

export async function addBranchSlot(input: { branchId: string; room: string; days: string; startTime: string; endTime: string; note?: string; capacity?: number | null }): Promise<SlotResult> {
  const s = await requireSession();
  if (!canEdit(s, input.branchId)) return { error: "forbidden" };

  const room = String(input.room ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  const days = String(input.days ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  const startTime = String(input.startTime ?? "").trim();
  const endTime = String(input.endTime ?? "").trim();
  const note = String(input.note ?? "").replace(/\s+/g, " ").trim().slice(0, 120) || null;
  if (room.length < 1) return { error: "room" };
  if (days.length < 2) return { error: "days" };
  if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime) || startTime >= endTime) return { error: "time" };
  // Sig'im: 1..200; bo'sh bo'lsa Xonalar bo'limidagi xona sig'imi (nom mos kelsa), u ham bo'lmasa cheksiz
  const capRaw = Math.trunc(Number(input.capacity));
  let capacity: number | null = Number.isFinite(capRaw) && capRaw > 0 ? Math.min(capRaw, 200) : null;

  const branch = await prisma.branch.findUnique({ where: { id: input.branchId }, select: { id: true, name: true } });
  if (!branch) return { error: "branch" };
  if (capacity === null) {
    const r = await prisma.room.findFirst({ where: { branchId: branch.id, isActive: true, name: room }, select: { capacity: true } });
    if (r && r.capacity > 0) capacity = r.capacity;
  }

  const row = await prisma.branchSlot.create({ data: { branchId: branch.id, room, days, startTime, endTime, note, capacity, createdById: s.userId } });
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "BranchSlot", entityId: row.id, newValue: { branch: branch.name, room, days, startTime, endTime, note, capacity } });

  revalidatePath("/crm");
  revalidatePath("/dashboard");
  return { ok: true, slots: await listBranchSlots(branch.id) };
}

export async function removeBranchSlot(id: string): Promise<SlotResult> {
  const s = await requireSession();
  const row = await prisma.branchSlot.findUnique({ where: { id } });
  if (!row) return { error: "notfound" };
  if (!canEdit(s, row.branchId)) return { error: "forbidden" };

  await prisma.branchSlot.delete({ where: { id } });
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "BranchSlot", entityId: id, oldValue: { room: row.room, days: row.days, startTime: row.startTime, endTime: row.endTime } });

  revalidatePath("/crm");
  revalidatePath("/dashboard");
  return { ok: true, slots: await listBranchSlots(row.branchId) };
}
