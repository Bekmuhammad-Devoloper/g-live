"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getPermission, MODULES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { GROUP_FORMATS } from "@/lib/constants";
import { findRoomConflict, conflictLabel } from "../roomConflict";

export type FormState = { ok?: boolean; error?: string; detail?: string };

const GROUP_STATUSES = ["PLANNED", "ACTIVE", "FINISHED", "CANCELLED"] as const;
const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

// "1,3,5" ni tozalab 1..7 oralig'idagi noyob kunlarni tartiblab qaytaradi
function normalizeWeekdays(raw?: string | null): string | null {
  if (!raw) return null;
  const days = Array.from(
    new Set(raw.split(",").map((x) => parseInt(x, 10)).filter((n) => n >= 1 && n <= 7))
  );
  days.sort((a, b) => a - b);
  return days.length ? days.join(",") : null;
}

// ─── Guruh sozlamalarini tahrirlash ───
export async function updateGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireSession();
  if (getPermission(s.role, MODULES.GROUPS) !== "FULL") return { error: "forbidden" };

  const id = String(formData.get("groupId") ?? "");
  if (!id) return { error: "invalid" };

  const existing = await prisma.group.findUnique({ where: { id } });
  if (!existing) return { error: "invalid" };

  const name = String(formData.get("name") ?? "").trim();
  const programId = String(formData.get("programId") ?? "").trim();
  if (name.length < 2 || !programId) return { error: "invalid" };

  const rawFormat = String(formData.get("format") ?? "OFFLINE");
  const format = (GROUP_FORMATS as readonly string[]).includes(rawFormat) ? rawFormat : "OFFLINE";

  const rawStatus = String(formData.get("status") ?? existing.status);
  const status = (GROUP_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus : existing.status;

  const capacityRaw = parseInt(String(formData.get("capacity") ?? ""), 10);
  const capacity = Number.isFinite(capacityRaw) && capacityRaw > 0 && capacityRaw <= 100 ? capacityRaw : existing.capacity;

  const startTimeRaw = String(formData.get("startTime") ?? "");
  const endTimeRaw = String(formData.get("endTime") ?? "");
  const startTime = timeRe.test(startTimeRaw) ? startTimeRaw : null;
  const endTime = timeRe.test(endTimeRaw) ? endTimeRaw : null;

  const startDateRaw = String(formData.get("startDate") ?? "");
  const endDateRaw = String(formData.get("endDate") ?? "");
  const teacherId = String(formData.get("teacherId") ?? "").trim() || null;
  const levelCode = String(formData.get("levelCode") ?? "").trim() || null;
  const colorRaw = String(formData.get("color") ?? "").trim();
  const color = /^#[0-9a-fA-F]{6}$/.test(colorRaw) ? colorRaw : null;
  const room = String(formData.get("room") ?? "").trim() || null;
  const onlineLink = String(formData.get("onlineLink") ?? "").trim() || null;
  const weekdays = normalizeWeekdays(String(formData.get("weekdays") ?? ""));
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000) || null;
  const feeRaw = parseInt(String(formData.get("monthlyFee") ?? ""), 10);
  const monthlyFee = Number.isFinite(feeRaw) && feeRaw >= 0 ? feeRaw : null;

  // Xona bandligi: shu xonada vaqti kesishadigan boshqa guruh bo'lsa — taqiqlanadi
  const conflict = await findRoomConflict({ room, weekdays, startTime, endTime, branchId: existing.branchId, excludeId: id });
  if (conflict) return { error: "room_conflict", detail: conflictLabel(conflict) };

  const data = {
    name,
    programId,
    teacherId,
    levelCode,
    color,
    format,
    onlineLink: format === "OFFLINE" ? null : onlineLink,
    room,
    capacity,
    status,
    startDate: startDateRaw ? new Date(startDateRaw) : null,
    endDate: endDateRaw ? new Date(endDateRaw) : null,
    weekdays,
    startTime,
    endTime,
    note,
    monthlyFee,
  };

  await prisma.group.update({ where: { id }, data });
  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "Group",
    entityId: id,
    oldValue: {
      name: existing.name,
      programId: existing.programId,
      teacherId: existing.teacherId,
      levelCode: existing.levelCode,
      format: existing.format,
      room: existing.room,
      capacity: existing.capacity,
      status: existing.status,
    },
    newValue: { name, programId, teacherId, levelCode, format, room, capacity, status },
  });
  revalidatePath(`/groups/${id}`);
  revalidatePath("/groups");
  return { ok: true };
}
