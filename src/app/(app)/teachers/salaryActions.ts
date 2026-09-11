"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ROLES, parseMoney } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { writeAudit } from "@/lib/audit";

// Maoshni faqat rahbariyat boshqaradi
function canManage(role: string) {
  return [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR].includes(role as never);
}

export type SalaryResult = { ok: true } | { ok: false; error: string };

export async function setTeacherFiksa(teacherId: string, fiksa: number): Promise<SalaryResult> {
  const s = await requireSession();
  if (!canManage(s.role)) return { ok: false, error: "forbidden" };
  // Yuqori chegara SHART: Int'ga sig'maydigan qiymat SQLite'ga yozilib, keyin
  // /teachers butunlay ochilmay qolgan (2026-09-11)
  const amount = parseMoney(fiksa);
  if (amount === null) return { ok: false, error: tr(s.locale, { uz: "Summa juda katta (eng ko'pi 1 mlrd so'm) — nollar sonini tekshiring", ru: "Сумма слишком велика (макс. 1 млрд сум) — проверьте количество нулей", en: "Amount too large (max 1 billion) — check the number of zeros", de: "Betrag zu groß (max. 1 Mrd.) — Anzahl der Nullen prüfen" }) };
  const now = new Date();
  await prisma.user.update({ where: { id: teacherId }, data: { fiksa: amount } });
  await prisma.teacherSalary.upsert({
    where: { teacherId_year_month: { teacherId, year: now.getFullYear(), month: now.getMonth() + 1 } },
    create: { teacherId, year: now.getFullYear(), month: now.getMonth() + 1, fiksa: amount },
    update: { fiksa: amount },
  });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "TeacherSalary", entityId: teacherId, newValue: { fiksa: amount }, reason: "Fiksa o'zgartirildi" });
  revalidatePath("/teachers");
  return { ok: true };
}

export async function updateCurrentSalary(teacherId: string, bonus: number, penalty: number, kpi: number): Promise<SalaryResult> {
  const s = await requireSession();
  if (!canManage(s.role)) return { ok: false, error: "forbidden" };
  const b = parseMoney(bonus);
  const p = parseMoney(penalty);
  const k = parseMoney(kpi); // KPI bonus summasi (so'm)
  if (b === null || p === null || k === null) return { ok: false, error: tr(s.locale, { uz: "Summa juda katta (eng ko'pi 1 mlrd so'm) — nollar sonini tekshiring", ru: "Сумма слишком велика (макс. 1 млрд сум) — проверьте количество нулей", en: "Amount too large (max 1 billion) — check the number of zeros", de: "Betrag zu groß (max. 1 Mrd.) — Anzahl der Nullen prüfen" }) };
  const now = new Date();
  const teacher = await prisma.user.findUnique({ where: { id: teacherId }, select: { fiksa: true } });
  const fiksa = teacher?.fiksa ?? 0;
  // KPI bonus = asosiy standart summa (fiksa kabi) — User modelida ham yangilanadi
  await prisma.user.update({ where: { id: teacherId }, data: { kpiBonus: k } });
  await prisma.teacherSalary.upsert({
    where: { teacherId_year_month: { teacherId, year: now.getFullYear(), month: now.getMonth() + 1 } },
    create: { teacherId, year: now.getFullYear(), month: now.getMonth() + 1, fiksa, bonus: b, penalty: p, kpi: k },
    update: { bonus: b, penalty: p, kpi: k },
  });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "TeacherSalary", entityId: teacherId, newValue: { bonus: b, penalty: p, kpi: k }, reason: "Oylik maosh yangilandi" });
  revalidatePath("/teachers");
  return { ok: true };
}
