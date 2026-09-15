// Finance V2 — o'qituvchi tayinlash TARIXI (GroupTeacherAssignment, D1).
// `Group.teacherId` joriy holat; tarix REAL sana intervallari bilan saqlanadi
// (oy boshiga majburlanmaydi). Cutover'dan oldingi intervallar INFERRED —
// ular asosida POSTED earning yaratilmaydi (S1), faqat NEEDS_REVIEW.

import type { GroupTeacherAssignment } from "@prisma/client";

import type { FinanceDb } from "../db";
import { FINANCE_V2_DEFAULT_CUTOVER_ISO } from "../constants";
import { FinanceError } from "../errors";
import { financeAudit } from "../audit";
import { monthEnd, monthStart, type YearMonth } from "../period";
import { resolveRule } from "./rules";

/** Xizmat oyiga tegadigan tayinlashlar (bir lahza bo'lsa ham) */
export async function assignmentsForService(db: FinanceDb, groupId: string, serviceMonth: YearMonth): Promise<GroupTeacherAssignment[]> {
  const s = monthStart(serviceMonth);
  const e = monthEnd(serviceMonth);
  return db.groupTeacherAssignment.findMany({
    where: { groupId, effectiveFrom: { lt: e }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: s } }] },
    orderBy: [{ effectiveFrom: "asc" }],
  });
}

export interface SyncAssignmentOptions {
  at?: Date;
  actorId?: string | null;
  cutoverAt?: Date;
}

/**
 * `Group.teacherId` bilan MAIN tayinlashni sinxronlaydi: o'qituvchi almashgan
 * bo'lsa ochiq MAIN interval `at`da yopiladi, yangisi ochiladi. Birinchi yozuv
 * (tarix bo'sh) — guruh yaratilgan sanadan, cutover'dan oldin bo'lsa INFERRED.
 */
export async function syncGroupTeacherAssignment(db: FinanceDb, groupId: string, o: SyncAssignmentOptions = {}): Promise<boolean> {
  const at = o.at ?? new Date();
  const cutover = o.cutoverAt ?? new Date(FINANCE_V2_DEFAULT_CUTOVER_ISO);
  const group = await db.group.findUnique({ where: { id: groupId }, select: { teacherId: true, createdAt: true } });
  if (!group) return false;
  const open = await db.groupTeacherAssignment.findMany({ where: { groupId, role: "MAIN", effectiveTo: null } });
  const current = open.find((a) => a.teacherId === group.teacherId) ?? null;
  let changed = false;
  for (const a of open) {
    if (a.teacherId === group.teacherId) continue;
    await db.groupTeacherAssignment.update({ where: { id: a.id }, data: { effectiveTo: at < a.effectiveFrom ? a.effectiveFrom : at } });
    changed = true;
  }
  if (group.teacherId && !current) {
    const any = await db.groupTeacherAssignment.count({ where: { groupId } });
    const from = any === 0 ? group.createdAt : at;
    await db.groupTeacherAssignment.create({
      data: { groupId, teacherId: group.teacherId, role: "MAIN", effectiveFrom: from, source: from < cutover ? "INFERRED" : "KNOWN", createdById: o.actorId ?? null },
    });
    changed = true;
  }
  return changed;
}

export interface AssignTeacherInput {
  groupId: string;
  teacherId: string;
  role: "MAIN" | "ASSISTANT";
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  compensationRuleId?: string | null;
  note?: string | null;
  actorId?: string | null;
}

/** Aniq (KNOWN) tayinlash — UI orqali; bir o'qituvchining shu guruhdagi ochiq intervali yopiladi */
export async function assignTeacher(db: FinanceDb, i: AssignTeacherInput): Promise<GroupTeacherAssignment> {
  if (i.effectiveTo && i.effectiveTo <= i.effectiveFrom) throw new FinanceError("validation", "effectiveTo effectiveFrom'dan keyin bo'lishi kerak");
  if (i.compensationRuleId) {
    const r = await db.salaryRule.findUnique({ where: { id: i.compensationRuleId } });
    if (!r) throw new FinanceError("not_found", "Compensation qoidasi topilmadi");
  }
  const open = await db.groupTeacherAssignment.findMany({ where: { groupId: i.groupId, teacherId: i.teacherId, effectiveTo: null } });
  for (const a of open) {
    if (a.effectiveFrom >= i.effectiveFrom) throw new FinanceError("validation", "Yangi tayinlash oldingisidan keyin boshlanishi kerak", { assignmentId: a.id });
    await db.groupTeacherAssignment.update({ where: { id: a.id }, data: { effectiveTo: i.effectiveFrom } });
  }
  const created = await db.groupTeacherAssignment.create({
    data: { groupId: i.groupId, teacherId: i.teacherId, role: i.role, effectiveFrom: i.effectiveFrom, effectiveTo: i.effectiveTo ?? null, compensationRuleId: i.compensationRuleId ?? null, source: "KNOWN", note: i.note ?? null, createdById: i.actorId ?? null },
  });
  if (i.role === "MAIN") {
    // Guruhning joriy MAIN o'qituvchisi ham yangilanadi (operatsion holat tarix bilan mos bo'lsin)
    if (!i.effectiveTo || i.effectiveTo > new Date()) await db.group.update({ where: { id: i.groupId }, data: { teacherId: i.teacherId } });
  }
  await financeAudit(db, { actorId: i.actorId, action: "CREATE", entityType: "GroupTeacherAssignment", entityId: created.id, newValue: { groupId: i.groupId, teacherId: i.teacherId, role: i.role, effectiveFrom: i.effectiveFrom, effectiveTo: i.effectiveTo ?? null, compensationRuleId: i.compensationRuleId ?? null }, reason: i.note ?? null });
  return created;
}

/** Tayinlashni yopish (o'chirilmaydi) */
export async function endAssignment(db: FinanceDb, id: string, effectiveTo: Date, actorId?: string | null, reason?: string): Promise<GroupTeacherAssignment> {
  const a = await db.groupTeacherAssignment.findUnique({ where: { id } });
  if (!a) throw new FinanceError("not_found", "Tayinlash topilmadi");
  if (a.effectiveTo) throw new FinanceError("state", "Tayinlash allaqachon yopilgan");
  if (effectiveTo <= a.effectiveFrom) throw new FinanceError("validation", "effectiveTo boshlanishdan keyin bo'lishi kerak");
  const updated = await db.groupTeacherAssignment.update({ where: { id }, data: { effectiveTo } });
  await financeAudit(db, { actorId, action: "END", entityType: "GroupTeacherAssignment", entityId: id, newValue: { effectiveTo }, reason: reason ?? null });
  return updated;
}

export interface RateSumCheck {
  totalBp: number;
  ok: boolean;
  parts: { assignmentId: string; teacherId: string; role: string; rateBp: number | null; ruleId: string | null }[];
}

/**
 * Guruh bo'yicha xizmat oyida PERCENT ulushlar yig'indisi ≤ 100% (S8). FIXED kirmaydi.
 * MAIN — umumiy qoidalar (o'quvchisiz kontekst), ASSISTANT — faqat assignment/TEACHER qoidasi.
 */
export async function groupRateSum(db: FinanceDb, groupId: string, serviceMonth: YearMonth): Promise<RateSumCheck> {
  const group = await db.group.findUnique({ where: { id: groupId }, select: { programId: true, branchId: true } });
  const parts: RateSumCheck["parts"] = [];
  for (const a of await assignmentsForService(db, groupId, serviceMonth)) {
    const rule = a.role === "MAIN"
      ? await resolveRule(db, { serviceMonth, teacherId: a.teacherId, groupId, programId: group?.programId, branchId: group?.branchId, assignmentRuleId: a.compensationRuleId }, "PERCENT")
      : await resolveRule(db, { serviceMonth, teacherId: a.teacherId, assignmentRuleId: a.compensationRuleId }, "PERCENT", ["ASSIGNMENT", "TEACHER"]);
    parts.push({ assignmentId: a.id, teacherId: a.teacherId, role: a.role, rateBp: rule?.rateBp ?? null, ruleId: rule?.id ?? null });
  }
  // Bir MAIN o'rnini bosuvchi (ketma-ket) intervallar bir vaqtda emas — yig'indiga faqat ustma-ust tushganlar
  // kiradi; oddiy holat uchun hammasi qo'shiladi (konservativ).
  const totalBp = parts.reduce((s, p) => s + (p.rateBp ?? 0), 0);
  return { totalBp, ok: totalBp <= 10_000, parts };
}
