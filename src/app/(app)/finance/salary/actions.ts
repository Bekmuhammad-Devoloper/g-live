"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAX_MONEY } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canRead, getPermission, MODULES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { setSetting } from "@/lib/settings";
import {
  computeSalaries, getSalarySettings, salarySettingKey, SALARY_SETTING_KEYS, SALARY_TYPES,
  type SalaryCalcResult, type SalarySettings,
} from "@/lib/salaryCalc";

export type RuleState = { ok?: boolean; error?: string };

const canManage = (role: string) => getPermission(role, MODULES.SALARY) === "FULL";

const schema = z.object({
  id: z.string().optional(),
  scope: z.enum(["ALL", "TEACHER", "COURSE", "GROUP", "STUDENT"]),
  amountType: z.enum(SALARY_TYPES),
  amount: z.coerce.number().int().positive().max(MAX_MONEY), // Int'ga sig'masa sahifa yiqiladi
  targetId: z.string().optional(),
  groupId: z.string().optional(),
});

// Nishon nomini serverda aniqlaydi (mijozdan kelgan nomga ishonilmaydi)
async function targetNameOf(scope: string, id: string): Promise<string | null> {
  if (scope === "TEACHER") return (await prisma.user.findUnique({ where: { id }, select: { fullName: true } }))?.fullName ?? null;
  if (scope === "COURSE") return (await prisma.program.findUnique({ where: { id }, select: { name: true } }))?.name ?? null;
  if (scope === "GROUP") return (await prisma.group.findUnique({ where: { id }, select: { name: true } }))?.name ?? null;
  if (scope === "STUDENT") return (await prisma.student.findUnique({ where: { id }, select: { fullName: true } }))?.fullName ?? null;
  return null;
}

// Qoida qo'shish yoki tahrirlash (id bo'lsa — tahrir)
export async function saveSalaryRule(_prev: RuleState, formData: FormData): Promise<RuleState> {
  const s = await requireSession();
  if (!canManage(s.role)) return { error: "forbidden" };

  const parsed = schema.safeParse({
    id: formData.get("id") || undefined,
    scope: formData.get("scope"),
    amountType: formData.get("amountType"),
    amount: formData.get("amount"),
    targetId: formData.get("targetId") || undefined,
    groupId: formData.get("groupId") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  if (d.amountType.includes("percentage") && d.amount > 100) return { error: "percent" };

  let targetName: string | null = null;
  let groupName: string | null = null;
  if (d.scope !== "ALL") {
    if (!d.targetId) return { error: "target" };
    targetName = await targetNameOf(d.scope, d.targetId);
    if (!targetName) return { error: "target" };
    if (d.scope === "STUDENT") {
      if (!d.groupId) return { error: "group" };
      const gs = await prisma.groupStudent.findUnique({
        where: { groupId_studentId: { groupId: d.groupId, studentId: d.targetId } },
        select: { group: { select: { name: true } } },
      });
      if (!gs) return { error: "group" };
      groupName = gs.group.name;
    }
  }

  const data = {
    scope: d.scope,
    amountType: d.amountType,
    amount: d.amount,
    isDefault: d.scope === "ALL",
    targetId: d.scope === "ALL" ? null : d.targetId!,
    targetName,
    groupId: d.scope === "STUDENT" ? d.groupId! : null,
    groupName,
  };

  // Standart (filial) qoida bitta — mavjud bo'lsa o'sha yangilanadi
  let editId = d.id;
  if (!editId && d.scope === "ALL") {
    editId = (await prisma.salaryRule.findFirst({ where: { OR: [{ isDefault: true }, { scope: "ALL" }] }, orderBy: { createdAt: "desc" }, select: { id: true } }))?.id;
  }

  if (editId) {
    const old = await prisma.salaryRule.findUnique({ where: { id: editId } });
    if (!old) return { error: "invalid" };
    await prisma.salaryRule.update({ where: { id: editId }, data: { ...data, updatedById: s.userId, updatedAt: new Date() } });
    if (d.scope === "ALL") await prisma.salaryRule.deleteMany({ where: { id: { not: editId }, OR: [{ isDefault: true }, { scope: "ALL" }] } });
    await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "SalaryRule", entityId: editId, oldValue: old, newValue: data });
  } else {
    const row = await prisma.salaryRule.create({ data: { ...data, createdById: s.userId } });
    await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "SalaryRule", entityId: row.id, newValue: data });
  }

  revalidatePath("/finance/salary");
  return { ok: true };
}

export async function deleteSalaryRule(id: string): Promise<void> {
  const s = await requireSession();
  if (!canManage(s.role)) return;
  const old = await prisma.salaryRule.findUnique({ where: { id } });
  if (!old) return;
  await prisma.salaryRule.delete({ where: { id } }).catch(() => {});
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "SalaryRule", entityId: id, oldValue: old });
  revalidatePath("/finance/salary");
}

// Kalkulyator sozlamalari (Setting: salary_settings.<key> = "1" | "")
export async function saveSalarySettings(values: Partial<SalarySettings>): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!canManage(s.role)) return { error: "forbidden" };
  const old = await getSalarySettings();
  for (const k of SALARY_SETTING_KEYS) await setSetting(salarySettingKey(k), values[k] ? "1" : "");
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Setting", entityId: "salary_settings", oldValue: old, newValue: values });
  revalidatePath("/finance/salary");
  return { ok: true };
}

function parsePeriod(period: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return { year, month };
}

export type CalcResponse = { ok?: boolean; error?: string; result?: SalaryCalcResult };

// Hisoblash — faqat natija qaytaradi, hech narsa yozilmaydi
export async function calculateSalaries(period: string): Promise<CalcResponse> {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.SALARY)) return { error: "forbidden" };
  const p = parsePeriod(period);
  if (!p) return { error: "invalid" };
  const result = await computeSalaries({ ...p, branchId: s.branchId });
  return { ok: true, result };
}

export type PublishResponse = { ok?: boolean; error?: string; count?: number; skipped?: number; total?: number };

// "O'qituvchilar profilida ko'rsatish" — TeacherSalary.fiksa (va darslar/o'quvchilar soni) yoziladi.
// Bonus, ushlanma va KPI o'zgarmaydi; yopilgan oylar tegilmaydi.
export async function publishSalaries(period: string): Promise<PublishResponse> {
  const s = await requireSession();
  if (!canManage(s.role)) return { error: "forbidden" };
  const p = parsePeriod(period);
  if (!p) return { error: "invalid" };
  const { year, month } = p;

  const result = await computeSalaries({ year, month, branchId: s.branchId });
  let count = 0;
  let skipped = 0;
  for (const t of result.teachers) {
    const key = { teacherId_year_month: { teacherId: t.teacherId, year, month } };
    const existing = await prisma.teacherSalary.findUnique({ where: key, select: { closed: true } });
    if (existing?.closed) { skipped++; continue; }
    await prisma.teacherSalary.upsert({
      where: key,
      create: { teacherId: t.teacherId, year, month, fiksa: t.total, lessons: t.lessons, students: t.students },
      update: { fiksa: t.total, lessons: t.lessons, students: t.students },
    });
    count++;
  }

  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "TeacherSalary",
    entityId: `${year}-${month}`,
    newValue: { count, skipped, total: result.total, teachers: result.teachers.map((t) => ({ id: t.teacherId, fiksa: t.total })) },
    reason: "Ish haqi kalkulyatori natijasi o'qituvchilar profiliga chiqarildi",
  });

  revalidatePath("/finance/salary");
  revalidatePath("/salary");
  return { ok: true, count, skipped, total: result.total };
}
