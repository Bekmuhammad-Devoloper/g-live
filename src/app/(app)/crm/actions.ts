"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canRead, canWrite, MODULES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { branchWhere } from "@/lib/branchScope";
import { ROLES, LEAD_STAGES, isSalesRole } from "@/lib/constants";
import { parseUzPhone } from "@/lib/phone";
import { getSetting, setSetting } from "@/lib/settings";
import { getBrand } from "@/lib/brand";
import { GROUP_COL_COLORS, GROUP_COL_ICONS, branchColKey, type CustomColumn, type GroupColumn } from "./_lib/leadColumns";
import { leaveGroups } from "@/lib/leaveGroup";

const schema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(5),
  source: z.string().optional(),
  interestCourse: z.string().optional(),
  budget: z.coerce.number().int().nonnegative().optional(),
  stage: z.enum(LEAD_STAGES),
  note: z.string().optional(),
  groupId: z.string().min(1).optional(),
  kanbanColumnId: z.string().min(1).optional(),
});

export type LeadState = { ok?: boolean; error?: string; dup?: { name: string; branch: string | null; stage: string; count: number } };

export async function createLead(_prev: LeadState, formData: FormData): Promise<LeadState> {
  const s = await requireSession();

  if (!canWrite(s.role, MODULES.CRM)) {
    return { error: "forbidden" };
  }

  const parsed = schema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    source: formData.get("source") || undefined,
    interestCourse: formData.get("interestCourse") || undefined,
    budget: formData.get("budget") || undefined,
    stage: formData.get("stage"),
    note: formData.get("note") || undefined,
    groupId: formData.get("groupId") || undefined,
    kanbanColumnId: formData.get("kanbanColumnId") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  const { groupId, kanbanColumnId: colRaw, ...leadData } = parsed.data;
  const kanbanColumnId = colRaw && (await readCustomColumns()).some((c) => c.id === colRaw) ? colRaw : null;

  const normalized = parseUzPhone(leadData.phone);
  leadData.phone = normalized ?? leadData.phone.trim();
  const digits = leadData.phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return { error: "invalid_phone" };

  if (ENROLL_REQUIRED_STAGES.includes(leadData.stage) && !groupId) {
    return { error: "group_required" };
  }

  if (groupId) {
    const g = await prisma.group.findUnique({
      where: { id: groupId },
      select: { capacity: true, _count: { select: { students: { where: { isActive: true } } } } },
    });
    if (!g) return { error: "group_not_found" };
    if (g._count.students >= g.capacity) return { error: "group_full" };
  }

  const force = formData.get("force") === "1";
  const dups = await prisma.lead.findMany({
    where: { phone: leadData.phone },
    orderBy: { createdAt: "desc" },
    select: { fullName: true, stage: true, branch: { select: { name: true } } },
  });
  if (dups.length > 0 && !force) {
    const d = dups[0];
    return { error: "duplicate", dup: { name: d.fullName, branch: d.branch?.name ?? null, stage: d.stage, count: dups.length } };
  }

  const lead = await prisma.lead.create({
    data: {
      ...leadData,
      groupId: groupId ?? null,
      kanbanColumnId,
      utmSource: leadData.source,
      branchId: s.branchId,
      managerId: isSalesRole(s.role) ? s.userId : null,
      activities: {
        create: {
          authorId: s.userId,
          type: "note",
          result: (groupId ? "Lid yaratildi va guruhga yo'naltirildi" : "Lid yaratildi")
            + (dups.length > 0 ? ` (takroriy: bu raqam bilan avval ${dups.length} ta lid bor — ${Array.from(new Set(dups.map((d) => d.branch?.name ?? "filialsiz"))).join(", ")})` : ""),
        },
      },
    },
  });

  await writeAudit({
    actorId: s.userId,
    action: "CREATE",
    entityType: "Lead",
    entityId: lead.id,
    newValue: { fullName: lead.fullName, phone: lead.phone, stage: lead.stage, groupId: lead.groupId },
  });

  if (groupId && ENROLL_REQUIRED_STAGES.includes(lead.stage)) {
    const studentId = await applyEnrollment(lead, groupId);
    await prisma.lead.update({ where: { id: lead.id }, data: { studentId } });
    revalidatePath("/groups");
  }

  revalidatePath("/crm");
  return { ok: true };
}

export async function convertLead(leadId: string): Promise<void> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return;

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.studentId) return;

  const student = await prisma.student.create({
    data: {
      fullName: lead.fullName,
      phone: lead.phone,
      branchId: lead.branchId,
      eduStatus: "WAITING",
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { studentId: student.id, stage: "WON" },
  });

  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "Lead",
    entityId: leadId,
    newValue: { convertedToStudent: student.id, stage: "WON" },
    reason: "Lid o'quvchiga aylantirildi",
  });

  revalidatePath("/crm");
  revalidatePath("/groups");
}

async function applyEnrollment(
  lead: { id: string; fullName: string; phone: string; branchId: string | null; studentId: string | null; groupId: string | null },
  groupId: string,
): Promise<string> {
  let studentId = lead.studentId;
  if (!studentId) {
    const student = await prisma.student.create({
      data: { fullName: lead.fullName, phone: lead.phone, branchId: lead.branchId, eduStatus: "ACTIVE" },
    });
    studentId = student.id;
  } else {
    await prisma.student.update({ where: { id: studentId }, data: { eduStatus: "ACTIVE" } }).catch(() => {});
  }

  if (lead.groupId && lead.groupId !== groupId) {
    await prisma.groupStudent.updateMany({
      where: { groupId: lead.groupId, studentId },
      data: { isActive: false, leftAt: new Date() },
    }).catch(() => {});
  }

  await prisma.groupStudent.upsert({
    where: { groupId_studentId: { groupId, studentId } },
    update: { isActive: true },
    create: { groupId, studentId, isActive: true },
  });

  return studentId;
}

const ENROLL_REQUIRED_STAGES = ["WON", "PAID"];

export type StageResult = { ok?: boolean; error?: string; needGroup?: boolean };

export async function moveLeadStage(leadId: string, stage: string, reason?: string): Promise<StageResult> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return { error: "forbidden" };
  if (!LEAD_STAGES.includes(stage as (typeof LEAD_STAGES)[number])) return { error: "invalid" };

  const before = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!before) return { error: "not_found" };

  if (ENROLL_REQUIRED_STAGES.includes(stage) && !before.groupId) {
    return { error: "group_required", needGroup: true };
  }

  const data: Record<string, unknown> = { stage, kanbanColumnId: null, branchSlotId: null };
  if (stage === "LOST" && reason) data.lossReason = reason;

  if (ENROLL_REQUIRED_STAGES.includes(stage) && before.groupId) {
    const studentId = await applyEnrollment(before, before.groupId);
    data.studentId = studentId;
  }

  await prisma.lead.update({ where: { id: leadId }, data });
  await prisma.leadActivity.create({
    data: { leadId, authorId: s.userId, type: "stage_change", result: `Bosqich: ${stage}${reason ? " — " + reason : ""}` },
  }).catch(() => {});
  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "Lead",
    entityId: leadId,
    oldValue: { stage: before.stage },
    newValue: { stage },
    reason: "Voronka bosqichi o'zgartirildi",
  });
  revalidatePath("/crm");
  return { ok: true };
}

export interface EnrollGroupOpt {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  teacher: string | null;
  room: string | null;
  schedule: string | null;
  capacity: number;
  taken: number;
  status: string;
  note: string | null;
}
export interface EnrollOptions {
  courses: { id: string; name: string }[];
  groups: EnrollGroupOpt[];
}

const WEEKDAY_SHORT = ["", "Du", "Se", "Chor", "Pa", "Ju", "Sha", "Yak"];

export async function enrollOptions(): Promise<EnrollOptions> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return { courses: [], groups: [] };

  const groups = await prisma.group.findMany({
    where: {
      status: { in: ["PLANNED", "ACTIVE"] },
      ...(s.branchId ? { branchId: s.branchId } : {}),
      program: { isActive: true },
    },
    select: {
      id: true, name: true, room: true, capacity: true, status: true, note: true,
      weekdays: true, startTime: true, endTime: true,
      program: { select: { id: true, name: true } },
      teacher: { select: { fullName: true } },
      _count: { select: { students: { where: { isActive: true } } } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  const courseMap = new Map<string, string>();
  const list: EnrollGroupOpt[] = groups.map((g) => {
    courseMap.set(g.program.id, g.program.name);
    const days = (g.weekdays ?? "")
      .split(",").map((d) => WEEKDAY_SHORT[Number(d.trim())] ?? "").filter(Boolean).join(", ");
    const time = g.startTime && g.endTime ? `${g.startTime}–${g.endTime}` : g.startTime ?? "";
    const schedule = [days, time].filter(Boolean).join(" · ") || null;
    return {
      id: g.id, name: g.name,
      courseId: g.program.id, courseName: g.program.name,
      teacher: g.teacher?.fullName ?? null,
      room: g.room, schedule,
      capacity: g.capacity, taken: g._count.students, status: g.status,
      note: g.note,
    };
  });

  return {
    courses: [...courseMap].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    groups: list,
  };
}

export type EnrollResult = { ok?: boolean; error?: string; groupName?: string; editsLeft?: number };

export async function enrollLeadToGroup(leadId: string, groupId: string): Promise<EnrollResult> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return { error: "forbidden" };

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, fullName: true, phone: true, branchId: true, studentId: true, groupId: true, enrollEditCount: true, stage: true },
  });
  if (!lead) return { error: "not_found" };

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, name: true, capacity: true, program: { select: { name: true } }, _count: { select: { students: { where: { isActive: true } } } } },
  });
  if (!group) return { error: "group_not_found" };

  const isChange = Boolean(lead.groupId) && lead.groupId !== groupId;
  if (isChange && lead.enrollEditCount >= 1) {
    return { error: "edit_limit" };
  }
  if (lead.groupId === groupId && lead.stage === "WON") {
    return { ok: true, groupName: group.name, editsLeft: Math.max(0, 1 - lead.enrollEditCount) };
  }
  if (group._count.students >= group.capacity) return { error: "group_full" };

  const studentId = await applyEnrollment(lead, groupId);

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: {
      groupId,
      studentId,
      stage: "WON",
      kanbanColumnId: null,
      branchSlotId: null,
      enrollEditCount: isChange ? { increment: 1 } : undefined,
    },
    select: { enrollEditCount: true },
  });

  await prisma.leadActivity.create({
    data: {
      leadId, authorId: s.userId, type: "stage_change",
      result: isChange
        ? `Guruh o'zgartirildi: ${group.program.name} — ${group.name}`
        : `Qabul qilindi va guruhga yo'naltirildi: ${group.program.name} — ${group.name}`,
    },
  }).catch(() => {});

  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "Lead",
    entityId: leadId,
    oldValue: { stage: lead.stage, groupId: lead.groupId },
    newValue: { stage: "WON", groupId, studentId },
    reason: isChange ? "Lid guruhi o'zgartirildi (bir martalik)" : "Lid guruhga yo'naltirildi",
  });

  revalidatePath("/crm");
  revalidatePath(`/crm/${leadId}`);
  revalidatePath("/groups");
  revalidatePath("/students");
  return { ok: true, groupName: group.name, editsLeft: Math.max(0, 1 - updated.enrollEditCount) };
}

export type BulkResult = { ok: boolean; error?: string; count?: number };

export async function bulkLeadAction(
  leadIds: string[],
  action: "assign_manager" | "set_stage" | "add_note" | "delete" | "reset_new",
  payload?: { managerId?: string; stage?: string; note?: string }
): Promise<BulkResult> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return { ok: false, error: "forbidden" };
  if (!leadIds.length) return { ok: false, error: "empty" };

  const stages = LEAD_STAGES as readonly string[];

  switch (action) {
    case "assign_manager":
      if (!payload?.managerId) return { ok: false, error: "invalid" };
      await prisma.lead.updateMany({ where: { id: { in: leadIds } }, data: { managerId: payload.managerId } });
      break;
    case "set_stage": {
      if (!payload?.stage || !stages.includes(payload.stage)) return { ok: false, error: "invalid" };
      if (ENROLL_REQUIRED_STAGES.includes(payload.stage)) {
        return { ok: false, error: "group_required" };
      }
      await prisma.lead.updateMany({ where: { id: { in: leadIds } }, data: { stage: payload.stage } });
      break;
    }
    case "add_note":
      if (!payload?.note) return { ok: false, error: "invalid" };
      await prisma.leadActivity.createMany({ data: leadIds.map((id) => ({ leadId: id, authorId: s.userId, type: "note", result: payload!.note! })) });
      break;
    case "reset_new": {
      if (![ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ROP].includes(s.role as never)) return { ok: false, error: "forbidden" };
      await prisma.$transaction([
        prisma.lead.updateMany({ where: { id: { in: leadIds } }, data: { stage: "NEW", kanbanColumnId: null, branchSlotId: null, groupId: null, enrollEditCount: 0 } }),
        prisma.leadActivity.createMany({ data: leadIds.map((id) => ({ leadId: id, authorId: s.userId, type: "stage_change", result: "Yangiga qaytarildi (ustun bo'shatildi)" })) }),
      ]);
      await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Lead", newValue: { count: leadIds.length, stage: "NEW" }, reason: "Ustun bo'shatildi — lidlar Yangiga qaytarildi" });
      break;
    }
    case "delete": {
      const where = CAN_DELETE_LEAD.includes(s.role as never)
        ? { id: { in: leadIds }, stage: { in: ["TEST", "LOST"] } }
        : { id: { in: leadIds }, stage: "LOST" };
      await prisma.$transaction(async (tx) => {
        const victims = await tx.lead.findMany({ where, select: { id: true } });
        const ids = victims.map((v) => v.id);
        if (ids.length === 0) return;
        await tx.call.updateMany({ where: { leadId: { in: ids } }, data: { leadId: null } });
        await tx.lead.deleteMany({ where: { id: { in: ids } } });
      });
      break;
    }
    default:
      return { ok: false, error: "unknown" };
  }

  await writeAudit({ actorId: s.userId, action: action === "delete" ? "DELETE" : "UPDATE", entityType: "Lead", newValue: { bulk: action, count: leadIds.length }, reason: `Bulk: ${action}` });
  revalidatePath("/crm");
  return { ok: true, count: leadIds.length };
}

export async function addLeadActivity(leadId: string, type: string, result: string, nextStepAt?: string | null): Promise<void> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return;
  if (!result || result.trim().length < 1) return;
  await prisma.leadActivity.create({
    data: { leadId, authorId: s.userId, type: type || "note", result: result.trim(), nextStepAt: nextStepAt ? new Date(nextStepAt) : null },
  });
  await prisma.lead.update({ where: { id: leadId }, data: { updatedAt: new Date() } });
  revalidatePath("/crm");
  revalidatePath(`/crm/${leadId}`);
}

export interface LeadComment {
  id: string;
  text: string;
  authorName: string | null;
  authorRole: string | null;
  createdAt: string;
}

const commentSelect = {
  id: true, result: true, createdAt: true,
  author: { select: { fullName: true, role: true } },
} as const;

const toComment = (a: { id: string; result: string | null; createdAt: Date; author: { fullName: string; role: string } | null }): LeadComment => ({
  id: a.id,
  text: a.result ?? "",
  authorName: a.author?.fullName ?? null,
  authorRole: a.author?.role ?? null,
  createdAt: a.createdAt.toISOString(),
});

export async function listLeadComments(leadId: string): Promise<LeadComment[]> {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.CRM)) return [];
  const rows = await prisma.leadActivity.findMany({
    where: { leadId, type: "note", result: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: commentSelect,
  });
  return rows.map(toComment);
}

export async function addLeadComment(leadId: string, text: string): Promise<{ ok?: boolean; error?: string; comment?: LeadComment }> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return { error: "forbidden" };
  const body = (text || "").trim().slice(0, 2000);
  if (!body) return { error: "invalid" };
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) return { error: "notfound" };
  const row = await prisma.leadActivity.create({
    data: { leadId, authorId: s.userId, type: "note", result: body },
    select: commentSelect,
  });
  await prisma.lead.update({ where: { id: leadId }, data: { updatedAt: new Date() } });
  revalidatePath("/crm");
  revalidatePath(`/crm/${leadId}`);
  return { ok: true, comment: toComment(row) };
}

export async function setLeadManager(leadId: string, managerId: string | null): Promise<void> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return;
  await prisma.lead.update({ where: { id: leadId }, data: { managerId: managerId || null } });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Lead", entityId: leadId, newValue: { managerId }, reason: "Menejer tayinlandi" });
  revalidatePath("/crm");
  revalidatePath(`/crm/${leadId}`);
}

export async function updateLeadField(leadId: string, field: string, value: string): Promise<void> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return;
  const allowed = ["fullName", "phone", "email", "interestCourse", "note", "source", "budget", "age", "level", "telegram", "studyFormat"];
  if (!allowed.includes(field)) return;
  if (field === "fullName" && (!value || value.trim().length < 2)) return;
  if (field === "studyFormat" && value && !["ONLINE", "OFFLINE"].includes(value.trim().toUpperCase())) return;
  const data: Record<string, unknown> =
    field === "budget" ? { budget: value ? Number(value) : null }
    : field === "age" ? { age: value ? Math.max(3, Math.min(99, Number(value) || 0)) || null : null }
    : field === "studyFormat" ? { studyFormat: value ? value.trim().toUpperCase() : null }
    : field === "telegram" ? { telegram: value.trim() ? "@" + value.trim().replace(/^@+/, "") : null }
    : { [field]: value || null };
  await prisma.lead.update({ where: { id: leadId }, data });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Lead", entityId: leadId, newValue: { [field]: value }, reason: "Maydon tahrirlandi" });
  revalidatePath(`/crm/${leadId}`);
  revalidatePath("/crm");
}

export interface BranchOpt { id: string; name: string }

export async function branchOptions(): Promise<BranchOpt[]> {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.CRM)) return [];
  return prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

export async function moveLeadToBranch(leadId: string, branchId: string): Promise<{ ok?: boolean; error?: string; branchName?: string }> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return { error: "forbidden" };

  const [lead, branch] = await Promise.all([
    prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, fullName: true, branchId: true } }),
    prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, name: true, isActive: true } }),
  ]);
  if (!lead) return { error: "not_found" };
  if (!branch || !branch.isActive) return { error: "invalid" };
  if (lead.branchId === branchId) return { ok: true, branchName: branch.name };

  await prisma.lead.update({ where: { id: leadId }, data: { branchId } });
  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "Lead",
    entityId: leadId,
    oldValue: { branchId: lead.branchId },
    newValue: { branchId },
    reason: `Lid boshqa filialga ko'chirildi: ${lead.fullName} → ${branch.name}`,
  });

  revalidatePath("/crm");
  revalidatePath(`/crm/${leadId}`);
  return { ok: true, branchName: branch.name };
}

const CAN_DELETE_LEAD = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];

export async function deleteTestLead(leadId: string): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!CAN_DELETE_LEAD.includes(s.role as never)) return { error: "forbidden" };
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { stage: true } });
  if (!lead) return { error: "not_found" };
  if (lead.stage !== "TEST") return { error: "not_test" };
  return deleteLeadPermanently(leadId);
}

export async function deleteLeadPermanently(leadId: string): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!CAN_DELETE_LEAD.includes(s.role as never)) return { error: "forbidden" };

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, fullName: true, phone: true, stage: true, studentId: true, _count: { select: { activities: true, calls: true } } },
  });
  if (!lead) return { error: "not_found" };

  await prisma.$transaction(async (tx) => {
    await tx.call.updateMany({ where: { leadId }, data: { leadId: null } });
    await tx.lead.delete({ where: { id: leadId } });
  });

  await writeAudit({
    actorId: s.userId,
    action: "DELETE",
    entityType: "Lead",
    entityId: leadId,
    oldValue: { fullName: lead.fullName, phone: lead.phone, stage: lead.stage, ...lead._count },
    reason: `Lid butunlay o'chirildi: ${lead.fullName}`,
  });

  revalidatePath("/crm");
  return { ok: true };
}

const KANBAN_GROUPS_KEY = "crm.kanbanGroups";

type PinnedRaw = { groupId: string; color: string; icon: string };

async function readPinned(): Promise<PinnedRaw[]> {
  const raw = await getSetting(KANBAN_GROUPS_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x): x is PinnedRaw => !!x && typeof x.groupId === "string")
      .map((x) => ({ groupId: x.groupId, color: String(x.color || "#10b981"), icon: String(x.icon || "layers") }));
  } catch {
    return [];
  }
}

export async function listKanbanGroups(): Promise<GroupColumn[]> {
  const pinned = await readPinned();
  if (pinned.length === 0) return [];

  const groups = await prisma.group.findMany({
    where: { id: { in: pinned.map((p) => p.groupId) } },
    select: { id: true, name: true, program: { select: { name: true } } },
  });
  const byId = new Map(groups.map((g) => [g.id, g]));

  return pinned
    .filter((p) => byId.has(p.groupId))
    .map((p) => {
      const g = byId.get(p.groupId)!;
      return { groupId: g.id, name: g.name, program: g.program?.name ?? null, color: p.color, icon: p.icon };
    });
}

export type PinResult = { ok?: boolean; error?: string; columns?: GroupColumn[] };

export async function pinKanbanGroup(groupId: string, color: string, icon: string): Promise<PinResult> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return { error: "forbidden" };

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!group) return { error: "group_not_found" };

  const safeColor = GROUP_COL_COLORS.includes(color) ? color : GROUP_COL_COLORS[0];
  const safeIcon = GROUP_COL_ICONS.includes(icon) ? icon : GROUP_COL_ICONS[0];

  const pinned = await readPinned();
  const next = pinned.filter((p) => p.groupId !== groupId);
  next.push({ groupId, color: safeColor, icon: safeIcon });
  await setSetting(KANBAN_GROUPS_KEY, JSON.stringify(next));

  revalidatePath("/crm");
  return { ok: true, columns: await listKanbanGroups() };
}

export async function unpinKanbanGroup(groupId: string): Promise<PinResult> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return { error: "forbidden" };

  const pinned = await readPinned();
  await setSetting(KANBAN_GROUPS_KEY, JSON.stringify(pinned.filter((p) => p.groupId !== groupId)));

  revalidatePath("/crm");
  return { ok: true, columns: await listKanbanGroups() };
}

const KANBAN_COLUMNS_KEY = "crm.kanbanColumns";
const MAX_CUSTOM_COLUMNS = 12;

async function readCustomColumns(): Promise<CustomColumn[]> {
  const raw = await getSetting(KANBAN_COLUMNS_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x): x is CustomColumn => !!x && typeof x.id === "string" && typeof x.name === "string")
      .map((x) => ({ id: x.id, name: x.name, color: String(x.color || GROUP_COL_COLORS[0]), icon: String(x.icon || GROUP_COL_ICONS[0]) }));
  } catch {
    return [];
  }
}

const colOrderKey = (userId: string) => `crm.colOrder.${userId}`;

export async function getKanbanOrder(): Promise<string[]> {
  const s = await requireSession();
  try {
    const arr = JSON.parse((await getSetting(colOrderKey(s.userId))) || "[]");
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, 100) : [];
  } catch {
    return [];
  }
}

export async function saveKanbanOrder(keys: string[]): Promise<{ ok: boolean }> {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.CRM)) return { ok: false };
  const clean = Array.from(new Set((Array.isArray(keys) ? keys : []).filter((k) => typeof k === "string" && k.length <= 80))).slice(0, 100);
  await setSetting(colOrderKey(s.userId), JSON.stringify(clean));
  return { ok: true };
}

export async function listKanbanColumns(): Promise<CustomColumn[]> {
  return readCustomColumns();
}

export type ColumnResult = { ok?: boolean; error?: string; columns?: CustomColumn[] };

export async function createKanbanColumn(name: string, color: string, icon: string): Promise<ColumnResult> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return { error: "forbidden" };

  const clean = name.replace(/\s+/g, " ").trim();
  if (clean.length < 2 || clean.length > 40) return { error: "invalid_name" };

  const cols = await readCustomColumns();
  if (cols.length >= MAX_CUSTOM_COLUMNS) return { error: "limit" };
  if (cols.some((c) => c.name.toLowerCase() === clean.toLowerCase())) return { error: "duplicate" };

  const col: CustomColumn = {
    id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: clean,
    color: GROUP_COL_COLORS.includes(color) ? color : GROUP_COL_COLORS[0],
    icon: GROUP_COL_ICONS.includes(icon) ? icon : GROUP_COL_ICONS[0],
  };
  await setSetting(KANBAN_COLUMNS_KEY, JSON.stringify([...cols, col]));
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "KanbanColumn", entityId: col.id, newValue: { name: clean } });

  revalidatePath("/crm");
  return { ok: true, columns: [...cols, col] };
}

export async function removeKanbanColumn(id: string): Promise<ColumnResult> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return { error: "forbidden" };

  const cols = await readCustomColumns();
  const next = cols.filter((c) => c.id !== id);
  await setSetting(KANBAN_COLUMNS_KEY, JSON.stringify(next));
  await prisma.lead.updateMany({ where: { kanbanColumnId: id }, data: { kanbanColumnId: null } });
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "KanbanColumn", entityId: id });

  revalidatePath("/crm");
  return { ok: true, columns: next };
}

export async function moveLeadToColumn(leadId: string, columnId: string): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return { error: "forbidden" };

  const col = (await readCustomColumns()).find((c) => c.id === columnId);
  if (!col) return { error: "column_not_found" };

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, kanbanColumnId: true } });
  if (!lead) return { error: "not_found" };
  if (lead.kanbanColumnId === columnId) return { ok: true };

  await prisma.lead.update({ where: { id: leadId }, data: { kanbanColumnId: columnId, branchSlotId: null } });
  await prisma.leadActivity.create({
    data: { leadId, authorId: s.userId, type: "note", result: `Ustunga ko'chirildi: ${col.name}` },
  }).catch(() => {});

  revalidatePath("/crm");
  return { ok: true };
}

const LEVEL_TEST_PATH = "/daraja-testi";

export type LevelTestQr = { url: string; modules: string; size: number; mark?: string; error?: string };

export async function getLevelTestQr(): Promise<LevelTestQr> {
  const s = await requireSession();
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  const url = `${proto}://${host}${LEVEL_TEST_PATH}`;
  if (!canRead(s.role, MODULES.CRM)) return { url, modules: "", size: 0, error: "forbidden" };
  try {
    const q = QRCode.create(url, { errorCorrectionLevel: "H" });
    const modules = Array.from(q.modules.data, (b) => (b ? "1" : "0")).join("");
    const mark = (await getBrand()).isMain ? "/logo-mark.png" : "";
    return { url, modules, size: q.modules.size, mark };
  } catch {
    return { url, modules: "", size: 0, error: "qr_failed" };
  }
}

export async function dropLeadToBranch(leadId: string, branchId: string, slotId: string | null = null): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return { error: "forbidden" };

  const [lead, branch, slot] = await Promise.all([
    prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, stage: true, branchId: true } }),
    prisma.branch.findFirst({ where: { id: branchId, isActive: true }, select: { id: true, name: true } }),
    slotId ? prisma.branchSlot.findFirst({ where: { id: slotId, branchId }, select: { id: true, room: true, days: true, startTime: true, endTime: true, capacity: true, _count: { select: { leads: true } } } }) : Promise.resolve(null),
  ]);
  if (!lead || !branch) return { error: "notfound" };
  if (slotId && !slot) return { error: "slot_not_found" };
  if (slot?.capacity) {
    const already = await prisma.lead.count({ where: { branchSlotId: slot.id, NOT: { id: leadId } } });
    if (already >= slot.capacity) return { error: "slot_full" };
  }

  const early = ["NEW", "IN_PROGRESS", "CONTACTED", "TEST"].includes(lead.stage);
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      branchId: branch.id,
      ...(early ? { stage: "OFFER" } : {}),
      kanbanColumnId: branchColKey(branch.id),
      branchSlotId: slot?.id ?? null,
      activities: { create: { authorId: s.userId, type: early ? "stage_change" : "note", result: `Filialga yo'naltirildi: ${branch.name}${slot ? ` — ${slot.room}, ${slot.days} ${slot.startTime}–${slot.endTime}` : ""}${early ? " (Taklif)" : ""}` } },
    },
  });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Lead", entityId: leadId, oldValue: { branchId: lead.branchId, stage: lead.stage }, newValue: { branchId: branch.id, ...(early ? { stage: "OFFER" } : {}) }, reason: `Filialga yo'naltirildi: ${branch.name}` });

  revalidatePath("/crm");
  return { ok: true };
}

export async function setLeadOnline(leadId: string, online: boolean): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return { error: "forbidden" };
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, stage: true, studyFormat: true } });
  if (!lead) return { error: "notfound" };

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      studyFormat: online ? "ONLINE" : null,
      stage: "NEW",
      kanbanColumnId: null,
      branchSlotId: null,
      activities: { create: { authorId: s.userId, type: "note", result: online ? "Onlayn ustuniga o'tkazildi" : "Onlayn belgisi olib tashlandi — Yangi" } },
    },
  });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Lead", entityId: leadId, oldValue: { studyFormat: lead.studyFormat, stage: lead.stage }, newValue: { studyFormat: online ? "ONLINE" : null, stage: "NEW" } });
  revalidatePath("/crm");
  return { ok: true };
}

export async function setLeadArchived(leadId: string, archived: boolean, kind: "STUDENT" | "LEAD" | null = null): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return { error: "forbidden" };

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, fullName: true, archivedAt: true, studentId: true } });
  if (!lead) return { error: "notfound" };
  if (!!lead.archivedAt === archived) return { ok: true };

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      archivedAt: archived ? new Date() : null,
      archiveKind: archived ? kind : null,
      ...(archived ? { branchSlotId: null } : {}),
      activities: { create: { authorId: s.userId, type: "note", result: archived ? "Arxivga tashlandi" : "Arxivdan qaytarildi" } },
    },
  });
  if (lead.studentId) await setStudentArchivedInternal(s.userId, lead.studentId, archived, false);
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Lead", entityId: leadId, newValue: { archived }, reason: archived ? `Lid arxivlandi: ${lead.fullName}` : `Lid arxivdan qaytarildi: ${lead.fullName}` });

  revalidatePath("/crm");
  revalidatePath("/students");
  return { ok: true };
}

async function setStudentArchivedInternal(actorId: string, studentId: string, archived: boolean, touchLeads: boolean): Promise<boolean> {
  const st = await prisma.student.findUnique({
    where: { id: studentId },
    select: { fullName: true, eduStatus: true, enrollments: { where: { isActive: true }, select: { id: true }, take: 1 } },
  });
  if (!st) return false;
  const isArchived = st.eduStatus === "ARCHIVED";
  if (isArchived === archived) return true;
  const next = archived ? "ARCHIVED" : st.enrollments.length ? "ACTIVE" : "WAITING";
  await prisma.student.update({ where: { id: studentId }, data: { eduStatus: next } });
  if (archived) await leaveGroups({ studentId, actorId, reason: "O'quvchi arxivlandi (Kanban)" });
  if (touchLeads) {
    await prisma.lead.updateMany({ where: { studentId }, data: archived ? { archivedAt: new Date(), branchSlotId: null } : { archivedAt: null } });
  }
  await writeAudit({
    actorId, action: "UPDATE", entityType: "Student", entityId: studentId,
    oldValue: { eduStatus: st.eduStatus }, newValue: { eduStatus: next },
    reason: archived ? `O'quvchi arxivlandi (Kanban): ${st.fullName}` : `O'quvchi arxivdan qaytarildi (Kanban): ${st.fullName}`,
  });
  return true;
}

export async function setStudentArchived(studentId: string, archived: boolean): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return { error: "forbidden" };
  const ok = await setStudentArchivedInternal(s.userId, studentId, archived, true);
  if (!ok) return { error: "notfound" };
  revalidatePath("/crm");
  revalidatePath("/students");
  return { ok: true };
}

export async function searchStudentsToArchive(q: string): Promise<{ id: string; fullName: string; phone: string | null; groupName: string | null }[]> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return [];
  const query = q.trim();
  if (query.length < 2) return [];
  const rows = await prisma.student.findMany({
    where: { AND: [{ eduStatus: { not: "ARCHIVED" } }, { OR: [{ fullName: { contains: query } }, { phone: { contains: query } }] }, branchWhere(s)] },
    select: { id: true, fullName: true, phone: true, enrollments: { where: { isActive: true }, take: 1, select: { group: { select: { name: true } } } } },
    orderBy: { fullName: "asc" },
    take: 8,
  });
  return rows.map((r) => ({ id: r.id, fullName: r.fullName, phone: r.phone, groupName: r.enrollments[0]?.group.name ?? null }));
}
