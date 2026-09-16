// Finance V2 — SalaryPolicy (versiyali, D2). BRANCH → GLOBAL, xizmat oyi bo'yicha.
// Eski versiya mutate qilinmaydi — yangi versiya `version+1`, eskisiga effectiveTo.

import type { SalaryPolicy } from "@prisma/client";

import { ASSIGNMENT_SPLIT_MODES, ATTENDANCE_MODES, DEFAULT_ATTENDANCE_COUNTED_STATUSES, NO_LESSONS_MODES, SALARY_BASE_MODES, SUPPORTED_ASSIGNMENT_SPLIT_MODES, SUPPORTED_NO_LESSONS_MODES } from "../constants";
import type { FinanceDb } from "../db";
import { FinanceError } from "../errors";
import { financeAudit } from "../audit";
import { isTashkentMonthStart, monthStart, type YearMonth } from "../period";

export interface SalaryPolicyView {
  id: string | null;
  name: string;
  version: number;
  branchId: string | null;
  salaryBaseMode: string;
  attendanceMode: string;
  attendanceCountedStatuses: string[];
  requireConfirmedAttendance: boolean;
  noLessonsMode: string;
  assignmentSplitMode: string;
  includeArchivedStudents: boolean;
  includeFrozenStudents: boolean;
  includeZeroAmounts: boolean;
}

/** Tasdiqlangan standart (S9, S10, D1): REAL_PAID, davomat NONE, review rejimlari */
export const DEFAULT_SALARY_POLICY: SalaryPolicyView = {
  id: null,
  name: "Standart",
  version: 0,
  branchId: null,
  salaryBaseMode: "REAL_PAID_AMOUNT",
  attendanceMode: "NONE",
  attendanceCountedStatuses: [...DEFAULT_ATTENDANCE_COUNTED_STATUSES],
  requireConfirmedAttendance: false,
  noLessonsMode: "NO_LESSONS_REVIEW",
  assignmentSplitMode: "REVIEW",
  includeArchivedStudents: true,
  includeFrozenStudents: true,
  includeZeroAmounts: false,
};

export function toSalaryPolicyView(p: SalaryPolicy): SalaryPolicyView {
  return {
    id: p.id, name: p.name, version: p.version, branchId: p.branchId, salaryBaseMode: p.salaryBaseMode, attendanceMode: p.attendanceMode,
    attendanceCountedStatuses: p.attendanceCountedStatuses.split(",").map((s) => s.trim()).filter(Boolean),
    requireConfirmedAttendance: p.requireConfirmedAttendance, noLessonsMode: p.noLessonsMode, assignmentSplitMode: p.assignmentSplitMode,
    includeArchivedStudents: p.includeArchivedStudents, includeFrozenStudents: p.includeFrozenStudents, includeZeroAmounts: p.includeZeroAmounts,
  };
}

/** Xizmat oyi uchun siyosat: filial → global; yozuv bo'lmasa standart (o'qishda yaratilmaydi) */
export async function resolveSalaryPolicy(db: FinanceDb, branchId: string | null, serviceMonth: YearMonth): Promise<SalaryPolicyView> {
  const at = monthStart(serviceMonth);
  const candidates = await db.salaryPolicy.findMany({
    where: {
      isActive: true,
      effectiveFrom: { lte: at },
      AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] }, branchId ? { OR: [{ branchId }, { branchId: null }] } : { branchId: null }],
    },
    orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }],
  });
  const hit = (branchId ? candidates.find((c) => c.branchId === branchId) : undefined) ?? candidates.find((c) => c.branchId === null);
  return hit ? toSalaryPolicyView(hit) : DEFAULT_SALARY_POLICY;
}

export interface CreateSalaryPolicyInput {
  name: string;
  branchId?: string | null;
  effectiveFrom: Date;
  salaryBaseMode?: string;
  attendanceMode?: string;
  attendanceCountedStatuses?: string[];
  requireConfirmedAttendance?: boolean;
  noLessonsMode?: string;
  assignmentSplitMode?: string;
  includeArchivedStudents?: boolean;
  includeFrozenStudents?: boolean;
  includeZeroAmounts?: boolean;
  note?: string | null;
  actorId?: string | null;
}

const inList = (v: string | undefined, list: readonly string[], label: string) => {
  if (v !== undefined && !list.includes(v)) throw new FinanceError("validation", `${label} noto'g'ri: ${v}`);
};

/** Yangi versiya (nom + filial bo'yicha). effectiveFrom — Tashkent oy boshi */
export async function createSalaryPolicyVersion(db: FinanceDb, i: CreateSalaryPolicyInput): Promise<SalaryPolicy> {
  if (!isTashkentMonthStart(i.effectiveFrom)) throw new FinanceError("validation", "effectiveFrom Tashkent oy boshi bo'lishi kerak");
  inList(i.salaryBaseMode, SALARY_BASE_MODES, "salaryBaseMode");
  inList(i.attendanceMode, ATTENDANCE_MODES, "attendanceMode");
  inList(i.noLessonsMode, NO_LESSONS_MODES, "noLessonsMode");
  inList(i.assignmentSplitMode, ASSIGNMENT_SPLIT_MODES, "assignmentSplitMode");
  if (i.noLessonsMode && !(SUPPORTED_NO_LESSONS_MODES as readonly string[]).includes(i.noLessonsMode)) throw new FinanceError("validation", "Hozircha faqat NO_LESSONS_REVIEW (S9)");
  if (i.assignmentSplitMode && !(SUPPORTED_ASSIGNMENT_SPLIT_MODES as readonly string[]).includes(i.assignmentSplitMode)) throw new FinanceError("validation", "Hozircha faqat REVIEW (D1)");
  const branchId = i.branchId ?? null;
  // Bitta doira (filial yoki global) uchun bir vaqtda BITTA siyosat: shu doiradagi barcha ochiq siyosatlar (nomidan qat'i nazar) yopiladi
  const openSameScope = await db.salaryPolicy.findMany({ where: { branchId, effectiveTo: null } });
  for (const prev of openSameScope) {
    if (prev.effectiveFrom >= i.effectiveFrom) throw new FinanceError("validation", "Yangi versiya oldingisidan keyingi oydan boshlanishi kerak", { previousId: prev.id, previousFrom: prev.effectiveFrom.toISOString() });
    await db.salaryPolicy.update({ where: { id: prev.id }, data: { effectiveTo: i.effectiveFrom } });
  }
  // Versiya raqami nom bo'yicha (unique [name, version]) — filialdan qat'i nazar
  const last = await db.salaryPolicy.findFirst({ where: { name: i.name }, orderBy: { version: "desc" } });
  const created = await db.salaryPolicy.create({
    data: {
      name: i.name, branchId, version: (last?.version ?? 0) + 1, effectiveFrom: i.effectiveFrom,
      salaryBaseMode: i.salaryBaseMode ?? "REAL_PAID_AMOUNT", attendanceMode: i.attendanceMode ?? "NONE",
      attendanceCountedStatuses: (i.attendanceCountedStatuses ?? [...DEFAULT_ATTENDANCE_COUNTED_STATUSES]).join(","),
      requireConfirmedAttendance: i.requireConfirmedAttendance ?? false, noLessonsMode: i.noLessonsMode ?? "NO_LESSONS_REVIEW",
      assignmentSplitMode: i.assignmentSplitMode ?? "REVIEW", includeArchivedStudents: i.includeArchivedStudents ?? true,
      includeFrozenStudents: i.includeFrozenStudents ?? true, includeZeroAmounts: i.includeZeroAmounts ?? false,
      note: i.note ?? null, createdById: i.actorId ?? null,
    },
  });
  await financeAudit(db, { actorId: i.actorId, action: "CREATE", entityType: "SalaryPolicy", entityId: created.id, oldValue: openSameScope.length ? openSameScope.map((x) => ({ id: x.id, name: x.name, version: x.version })) : null, newValue: toSalaryPolicyView(created), reason: i.note ?? null });
  return created;
}

/** Versiya tarixi (UI uchun) */
export async function salaryPolicyHistory(db: FinanceDb, name?: string): Promise<SalaryPolicy[]> {
  return db.salaryPolicy.findMany({ where: name ? { name } : {}, orderBy: [{ name: "asc" }, { branchId: "asc" }, { version: "desc" }] });
}
