"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canRead, canWrite, MODULES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { ROLES, LEAD_STAGES, isSalesRole } from "@/lib/constants";

const schema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(5),
  source: z.string().optional(),
  interestCourse: z.string().optional(),
  budget: z.coerce.number().int().nonnegative().optional(),
  stage: z.enum(LEAD_STAGES),
  note: z.string().optional(),
  // Ixtiyoriy: lid yaratilayotganda darhol mavjud guruhga yo'naltirish
  groupId: z.string().min(1).optional(),
});

export type LeadState = { ok?: boolean; error?: string };

export async function createLead(_prev: LeadState, formData: FormData): Promise<LeadState> {
  const s = await requireSession();

  // RBAC — serverda tekshiriladi (interfeys darajasidan tashqari)
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
  });
  if (!parsed.success) return { error: "invalid" };

  const { groupId, ...leadData } = parsed.data;

  // Majburiylik qoidasi yaratishda ham amal qiladi: guruhsiz "Qabul qilindi"
  // bo'lmaydi (aks holda forma orqali qoidani chetlab o'tish mumkin bo'lardi).
  if (ENROLL_REQUIRED_STAGES.includes(leadData.stage) && !groupId) {
    return { error: "group_required" };
  }

  // Guruh tanlangan bo'lsa — mavjudligini va joy borligini tekshiramiz
  if (groupId) {
    const g = await prisma.group.findUnique({
      where: { id: groupId },
      select: { capacity: true, _count: { select: { students: { where: { isActive: true } } } } },
    });
    if (!g) return { error: "group_not_found" };
    if (g._count.students >= g.capacity) return { error: "group_full" };
  }

  // Dublikat telefon tekshiruvi (TZ FR-CRM-03 — ogohlantirish)
  const dup = await prisma.lead.findFirst({ where: { phone: parsed.data.phone } });
  if (dup) return { error: "duplicate" };

  const lead = await prisma.lead.create({
    data: {
      ...leadData,
      groupId: groupId ?? null,
      utmSource: leadData.source,
      branchId: s.branchId,
      managerId: isSalesRole(s.role) ? s.userId : null,
      activities: {
        create: { authorId: s.userId, type: "note", result: groupId ? "Lid yaratildi va guruhga yo'naltirildi" : "Lid yaratildi" },
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

  // "Qabul qilindi" bosqichida yaratilsa — o'quvchini darhol guruhga yozamiz
  if (groupId && ENROLL_REQUIRED_STAGES.includes(lead.stage)) {
    const studentId = await applyEnrollment(lead, groupId);
    await prisma.lead.update({ where: { id: lead.id }, data: { studentId } });
    revalidatePath("/groups");
  }

  revalidatePath("/crm");
  return { ok: true };
}

// Lidni o'quvchiga aylantirish (konvertatsiya) — TZ 3-bosqich "Guruhga qabul"
export async function convertLead(leadId: string): Promise<void> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return;

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.studentId) return; // allaqachon aylantirilgan

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

/**
 * Lidni guruhga HAQIQATAN biriktiradi: o'quvchi yaratadi (yo'q bo'lsa),
 * eski guruhdan chiqaradi va yangisiga yozadi.
 *
 * `enrollLeadToGroup` ham, `moveLeadStage` ham shuni chaqiradi — shuning uchun
 * guruh qayerda tanlanishidan qat'i nazar (drawer, yoki lid yaratishda)
 * o'quvchi guruhda albatta paydo bo'ladi. Takror chaqirilsa zarar qilmaydi.
 */
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

  // Guruh almashsa — eskisidan chiqaramiz
  if (lead.groupId && lead.groupId !== groupId) {
    await prisma.groupStudent.updateMany({
      where: { groupId: lead.groupId, studentId },
      data: { isActive: false, leftAt: new Date() }, // to'lov hisobi shu oyda to'xtaydi
    }).catch(() => {});
  }

  await prisma.groupStudent.upsert({
    where: { groupId_studentId: { groupId, studentId } },
    update: { isActive: true },
    create: { groupId, studentId, isActive: true },
  });

  return studentId;
}

// "Qabul qilindi" hisoblanadigan bosqichlar — bularga o'tish uchun guruh SHART
const ENROLL_REQUIRED_STAGES = ["WON", "PAID"];

// Voronka bosqichini o'zgartirish (LOST uchun sabab qo'shiladi)
export type StageResult = { ok?: boolean; error?: string; needGroup?: boolean };

export async function moveLeadStage(leadId: string, stage: string, reason?: string): Promise<StageResult> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return { error: "forbidden" };
  if (!LEAD_STAGES.includes(stage as (typeof LEAD_STAGES)[number])) return { error: "invalid" };

  const before = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!before) return { error: "not_found" };

  // MAJBURIY QOIDA: guruhga yo'naltirilmagan lid "Qabul qilindi" bo'la olmaydi.
  // Interfeys buni drawer bilan hal qiladi; bu — serverdagi ishonchli to'siq.
  if (ENROLL_REQUIRED_STAGES.includes(stage) && !before.groupId) {
    return { error: "group_required", needGroup: true };
  }

  const data: Record<string, unknown> = { stage };
  if (stage === "LOST" && reason) data.lossReason = reason;

  // Guruh lid YARATILISHIDA tanlangan bo'lishi mumkin — u holda o'quvchi hali
  // guruhga yozilmagan. "Qabul qilindi" ga o'tishda buni kafolatlaymiz,
  // aks holda lidda guruh ko'rinadi-yu, o'quvchi guruhda bo'lmaydi.
  if (ENROLL_REQUIRED_STAGES.includes(stage) && before.groupId) {
    const studentId = await applyEnrollment(before, before.groupId);
    data.studentId = studentId;
  }

  await prisma.lead.update({ where: { id: leadId }, data });
  // Bosqich o'zgarishini faoliyat sifatida yozish
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

// ─── Guruhga yo'naltirish (WON uchun majburiy qadam) ───

export interface EnrollGroupOpt {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  teacher: string | null;
  room: string | null;
  schedule: string | null;   // "Du, Chor, Ju · 18:00–20:00"
  capacity: number;
  taken: number;             // faol o'quvchilar soni
  status: string;
  note: string | null;       // guruh izohi (kament)
}
export interface EnrollOptions {
  courses: { id: string; name: string }[];
  groups: EnrollGroupOpt[];
}

const WEEKDAY_SHORT = ["", "Du", "Se", "Chor", "Pa", "Ju", "Sha", "Yak"];

/** Drawer ochilganda kurs va guruhlar ro'yxatini beradi. */
export async function enrollOptions(): Promise<EnrollOptions> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return { courses: [], groups: [] };

  const groups = await prisma.group.findMany({
    where: {
      status: { in: ["PLANNED", "ACTIVE"] },       // tugagan/bekor qilinganlar taklif qilinmaydi
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

/**
 * Lidni guruhga yo'naltiradi va "Qabul qilindi" (WON) bosqichiga o'tkazadi.
 *
 * Qoidalar:
 *  • Birinchi biriktirish — cheklovsiz (WON bo'lish uchun shart).
 *  • Keyin guruhni FAQAT BIR MARTA o'zgartirish mumkin (enrollEditCount < 1).
 *  • O'quvchi yo'q bo'lsa avtomatik yaratiladi (konvertatsiya).
 */
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
    return { error: "edit_limit" };   // bir martalik o'zgartirish allaqachon ishlatilgan
  }
  if (lead.groupId === groupId && lead.stage === "WON") {
    return { ok: true, groupName: group.name, editsLeft: Math.max(0, 1 - lead.enrollEditCount) };
  }
  if (group._count.students >= group.capacity) return { error: "group_full" };

  const studentId = await applyEnrollment(lead, groupId);

  // 4) Lidni yangilaymiz
  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: {
      groupId,
      studentId,
      stage: "WON",
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

// ─── Bulk amallar (bir nechta lid ustida) ───
export type BulkResult = { ok: boolean; error?: string; count?: number };

export async function bulkLeadAction(
  leadIds: string[],
  action: "assign_manager" | "set_stage" | "add_note" | "delete",
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
      // "Qabul qilindi" har bir lid uchun guruh tanlashni talab qiladi —
      // ommaviy amalda buni so'rab bo'lmaydi, shuning uchun taqiqlanadi.
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
    case "delete":
      // Faqat yo'qotilgan (LOST) lidlarni o'chirish mumkin
      await prisma.lead.deleteMany({ where: { id: { in: leadIds }, stage: "LOST" } });
      break;
    default:
      return { ok: false, error: "unknown" };
  }

  await writeAudit({ actorId: s.userId, action: action === "delete" ? "DELETE" : "UPDATE", entityType: "Lead", newValue: { bulk: action, count: leadIds.length }, reason: `Bulk: ${action}` });
  revalidatePath("/crm");
  return { ok: true, count: leadIds.length };
}

// ─── Faoliyat/izoh qo'shish ───
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

// ─── Menejer tayinlash ───
export async function setLeadManager(leadId: string, managerId: string | null): Promise<void> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return;
  await prisma.lead.update({ where: { id: leadId }, data: { managerId: managerId || null } });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Lead", entityId: leadId, newValue: { managerId }, reason: "Menejer tayinlandi" });
  revalidatePath("/crm");
  revalidatePath(`/crm/${leadId}`);
}

// ─── Maydonni inline tahrirlash (batafsil sahifa) ───
export async function updateLeadField(leadId: string, field: string, value: string): Promise<void> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return;
  const allowed = ["fullName", "phone", "email", "interestCourse", "note", "source", "budget"];
  if (!allowed.includes(field)) return;
  if (field === "fullName" && (!value || value.trim().length < 2)) return;
  const data: Record<string, unknown> = field === "budget" ? { budget: value ? Number(value) : null } : { [field]: value || null };
  await prisma.lead.update({ where: { id: leadId }, data });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Lead", entityId: leadId, newValue: { [field]: value }, reason: "Maydon tahrirlandi" });
  revalidatePath(`/crm/${leadId}`);
  revalidatePath("/crm");
}

// ─── Lidni boshqa filialga ko'chirish (2026-08-25 talab) ───
// Filial izolyatsiyasi joriy qilingach kerak bo'ldi: noto'g'ri filialga tushgan
// yoki boshqa filialga o'tkazilishi kerak bo'lgan lid ko'chiriladi.

export interface BranchOpt { id: string; name: string }

/** Ko'chirish uchun faol filiallar ro'yxati. */
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
