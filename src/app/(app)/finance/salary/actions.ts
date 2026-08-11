"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getPermission, MODULES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

export type RuleState = { ok?: boolean; error?: string };

const canManage = (role: string) => getPermission(role, MODULES.SALARY) === "FULL";

const schema = z.object({
  scope: z.enum(["ALL", "TEACHER", "COURSE", "GROUP", "STUDENT"]),
  amountType: z.enum(["FIXED", "PERCENT"]),
  amount: z.coerce.number().int().positive(),
  targetId: z.string().optional(),
  targetName: z.string().optional(),
  isDefault: z.coerce.boolean().optional(),
});

// Qoida qo'shish (standart yoki individual)
export async function addSalaryRule(_prev: RuleState, formData: FormData): Promise<RuleState> {
  const s = await requireSession();
  if (!canManage(s.role)) return { error: "forbidden" };

  const parsed = schema.safeParse({
    scope: formData.get("scope"),
    amountType: formData.get("amountType"),
    amount: formData.get("amount"),
    targetId: formData.get("targetId") || undefined,
    targetName: formData.get("targetName") || undefined,
    isDefault: formData.get("isDefault") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  const d = parsed.data;
  // Individual qoida uchun nishon majburiy (ALL dan tashqari)
  if (d.scope !== "ALL" && !d.targetId) return { error: "target" };

  // Standart (isDefault) qoida bitta bo'ladi — eskisini almashtiramiz
  if (d.isDefault) {
    await prisma.salaryRule.deleteMany({ where: { isDefault: true } });
  }

  await prisma.salaryRule.create({
    data: {
      scope: d.scope,
      amountType: d.amountType,
      amount: d.amount,
      isDefault: !!d.isDefault,
      targetId: d.scope === "ALL" ? null : d.targetId,
      targetName: d.scope === "ALL" ? null : d.targetName,
    },
  });

  revalidatePath("/finance/salary");
  return { ok: true };
}

export async function deleteSalaryRule(id: string): Promise<void> {
  const s = await requireSession();
  if (!canManage(s.role)) return;
  await prisma.salaryRule.delete({ where: { id } }).catch(() => {});
  revalidatePath("/finance/salary");
}

export type CalcState = { ok?: boolean; error?: string; count?: number; total?: number };

// Ish haqini hisoblash — qoidalar asosida TeacherSalary yozuvlarini yangilaydi
export async function calculateSalaries(_prev: CalcState, formData: FormData): Promise<CalcState> {
  const s = await requireSession();
  if (!canManage(s.role)) return { error: "forbidden" };

  const period = String(formData.get("period") || ""); // "YYYY-MM"
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return { error: "invalid" };
  const year = Number(m[1]);
  const month = Number(m[2]);

  const rules = await prisma.salaryRule.findMany();
  const def = rules.find((r) => r.isDefault) ?? null;
  const teacherRules = new Map(rules.filter((r) => r.scope === "TEACHER" && r.targetId).map((r) => [r.targetId!, r]));

  const teachers = await prisma.user.findMany({ where: { role: "TEACHER", isActive: true }, select: { id: true } });

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  let count = 0;
  let total = 0;
  for (const tc of teachers) {
    const rule = teacherRules.get(tc.id) ?? def;
    if (!rule) continue;

    let fiksa = 0;
    if (rule.amountType === "FIXED") {
      fiksa = rule.amount;
    } else {
      // PERCENT — o'qituvchi guruhlaridagi talabalarning shu oydagi PAID to'lovlaridan foiz
      const groups = await prisma.group.findMany({ where: { teacherId: tc.id }, select: { id: true } });
      const gIds = groups.map((g) => g.id);
      if (gIds.length) {
        const enroll = await prisma.groupStudent.findMany({ where: { groupId: { in: gIds } }, select: { studentId: true } });
        const sIds = [...new Set(enroll.map((e) => e.studentId))];
        if (sIds.length) {
          const agg = await prisma.payment.aggregate({
            _sum: { amount: true },
            where: { studentId: { in: sIds }, status: "PAID", createdAt: { gte: monthStart, lt: monthEnd } },
          });
          fiksa = Math.round(((agg._sum.amount ?? 0) * rule.amount) / 100);
        }
      }
    }

    await prisma.teacherSalary.upsert({
      where: { teacherId_year_month: { teacherId: tc.id, year, month } },
      create: { teacherId: tc.id, year, month, fiksa },
      update: { fiksa },
    });
    count++;
    total += fiksa;
  }

  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "TeacherSalary",
    entityId: `${year}-${month}`,
    newValue: { count, total },
    reason: "Ish haqi hisoblandi (kalkulyator)",
  });

  revalidatePath("/finance/salary");
  revalidatePath("/salary");
  return { ok: true, count, total };
}
