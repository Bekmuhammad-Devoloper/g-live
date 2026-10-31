"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getPermission, MODULES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { ROLES } from "@/lib/constants";
import { findRoomConflict, conflictLabel } from "../../groups/roomConflict";
import { enrollLeadToGroup } from "../../crm/actions";
import { listBranchSlots, type VSlot } from "./actions";

const DAY_NUM: Record<string, number> = { Du: 1, Se: 2, Chor: 3, Pay: 4, Ju: 5, Sha: 6, Yak: 7 };

export interface SlotGroupOptions {
  programs: { id: string; name: string; monthlyFee: number | null }[];
  teachers: { id: string; name: string }[];
}

async function allowed(role: string, sessionBranchId: string | null, branchId: string) {
  if (getPermission(role, MODULES.GROUPS) !== "FULL") return false;
  if (role === ROLES.ADMIN) return !sessionBranchId || sessionBranchId === branchId;
  return true;
}

export async function slotGroupOptions(slotId: string): Promise<SlotGroupOptions | null> {
  const s = await requireSession();
  const slot = await prisma.branchSlot.findUnique({ where: { id: slotId }, select: { branchId: true } });
  if (!slot || !(await allowed(s.role, s.branchId, slot.branchId))) return null;
  const [programs, teachers] = await Promise.all([
    prisma.program.findMany({ where: { isActive: true }, select: { id: true, name: true, monthlyFee: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: ROLES.TEACHER, isActive: true, OR: [{ branchId: slot.branchId }, { branches: { some: { branchId: slot.branchId } } }] },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);
  return { programs, teachers: teachers.map((t) => ({ id: t.id, name: t.fullName })) };
}

export type OpenGroupResult = { ok?: boolean; error?: string; detail?: string; groupId?: string; enrolled?: number; failed?: number; slots?: VSlot[] };

export async function openGroupFromSlot(
  slotId: string,
  input: { name: string; programId: string; teacherId?: string | null; startDate?: string | null; monthlyFee?: number | null; removeSlot?: boolean },
): Promise<OpenGroupResult> {
  const s = await requireSession();
  const slot = await prisma.branchSlot.findUnique({
    where: { id: slotId },
    include: { leads: { select: { id: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!slot) return { error: "notfound" };
  if (!(await allowed(s.role, s.branchId, slot.branchId))) return { error: "forbidden" };
  if (slot.leads.length === 0) return { error: "empty" };

  const name = String(input.name ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (name.length < 2) return { error: "name" };
  const program = await prisma.program.findUnique({ where: { id: input.programId }, select: { id: true } });
  if (!program) return { error: "program" };

  const weekdays = Array.from(new Set(slot.days.split(/\s*,\s*/).map((d) => DAY_NUM[d]).filter(Boolean))).sort().join(",") || null;
  const conflict = await findRoomConflict({ room: slot.room, weekdays, startTime: slot.startTime, endTime: slot.endTime, branchId: slot.branchId });
  if (conflict) return { error: "room_conflict", detail: conflictLabel(conflict) };

  const fee = Math.trunc(Number(input.monthlyFee));
  const startDate = input.startDate && /^\d{4}-\d{2}-\d{2}$/.test(input.startDate) ? new Date(`${input.startDate}T00:00:00`) : new Date();
  const group = await prisma.group.create({
    data: {
      name,
      programId: program.id,
      teacherId: input.teacherId || null,
      branchId: slot.branchId,
      room: slot.room,
      weekdays,
      startTime: slot.startTime,
      endTime: slot.endTime,
      capacity: Math.max(slot.capacity ?? 0, slot.leads.length),
      startDate,
      monthlyFee: Number.isFinite(fee) && fee > 0 ? fee : null,
      note: slot.note,
      format: "OFFLINE",
      status: "ACTIVE",
    },
  });

  let enrolled = 0;
  for (const l of slot.leads) {
    const r = await enrollLeadToGroup(l.id, group.id);
    if (r.ok) enrolled++;
  }

  if (input.removeSlot) await prisma.branchSlot.delete({ where: { id: slot.id } }).catch(() => {});

  await writeAudit({
    actorId: s.userId, action: "CREATE", entityType: "Group", entityId: group.id,
    newValue: { name, fromSlot: `${slot.room} · ${slot.days} · ${slot.startTime}`, enrolled, leads: slot.leads.length },
  });

  revalidatePath("/crm");
  revalidatePath("/groups");
  revalidatePath("/students");
  return { ok: true, groupId: group.id, enrolled, failed: slot.leads.length - enrolled, slots: await listBranchSlots(slot.branchId) };
}
