"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canWrite, MODULES } from "@/lib/rbac";
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
  });
  if (!parsed.success) return { error: "invalid" };

  // Dublikat telefon tekshiruvi (TZ FR-CRM-03 — ogohlantirish)
  const dup = await prisma.lead.findFirst({ where: { phone: parsed.data.phone } });
  if (dup) return { error: "duplicate" };

  const lead = await prisma.lead.create({
    data: {
      ...parsed.data,
      utmSource: parsed.data.source,
      branchId: s.branchId,
      managerId: isSalesRole(s.role) ? s.userId : null,
      activities: {
        create: { authorId: s.userId, type: "note", result: "Lid yaratildi" },
      },
    },
  });

  await writeAudit({
    actorId: s.userId,
    action: "CREATE",
    entityType: "Lead",
    entityId: lead.id,
    newValue: { fullName: lead.fullName, phone: lead.phone, stage: lead.stage },
  });

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

// Voronka bosqichini o'zgartirish (LOST uchun sabab qo'shiladi)
export async function moveLeadStage(leadId: string, stage: string, reason?: string): Promise<void> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return;
  if (!LEAD_STAGES.includes(stage as (typeof LEAD_STAGES)[number])) return;

  const before = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!before) return;

  const data: Record<string, unknown> = { stage };
  if (stage === "LOST" && reason) data.lossReason = reason;
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
    case "set_stage":
      if (!payload?.stage || !stages.includes(payload.stage)) return { ok: false, error: "invalid" };
      await prisma.lead.updateMany({ where: { id: { in: leadIds } }, data: { stage: payload.stage } });
      break;
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
