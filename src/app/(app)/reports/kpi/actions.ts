"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getPermission, MODULES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

export type KpiPayState = { ok?: boolean; error?: string };

/**
 * Xodimning oylik fiksa to'lovi va har bir muvaffaqiyatli lid uchun KPI bonusini yangilaydi.
 * Ruxsat: FAQAT ish haqi moduli FULL (Direktor / o'rinbosar / hisobchi).
 * `canWrite` YETARLI EMAS — o'qituvchida SALARY="OWN" bo'lib, u boshqa xodimning
 * oyligini o'zgartira olishi mumkin edi. Qolgan ustunlar lidlardan hisoblanadi.
 */
export async function saveKpiPay(userId: string, fiksa: number, kpiBonus: number): Promise<KpiPayState> {
  const s = await requireSession();
  if (getPermission(s.role, MODULES.SALARY) !== "FULL") return { error: "forbidden" };
  if (!userId) return { error: "invalid" };

  const f = Math.max(0, Math.round(Number(fiksa) || 0));
  const b = Math.max(0, Math.round(Number(kpiBonus) || 0));
  if (!Number.isFinite(f) || !Number.isFinite(b)) return { error: "invalid" };

  const before = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, fiksa: true, kpiBonus: true } });
  if (!before) return { error: "notfound" };

  await prisma.user.update({ where: { id: userId }, data: { fiksa: f, kpiBonus: b } });
  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "User",
    entityId: userId,
    oldValue: { fiksa: before.fiksa, kpiBonus: before.kpiBonus },
    newValue: { fiksa: f, kpiBonus: b },
    reason: `KPI to'lovi yangilandi (${before.fullName})`,
  });

  revalidatePath("/reports/kpi");
  revalidatePath("/users");
  return { ok: true };
}
