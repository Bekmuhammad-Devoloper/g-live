"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getPermission, MODULES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { parseMoney } from "@/lib/constants";
import { parsePercent } from "@/lib/salesCommission";

export type KpiPayState = { ok?: boolean; error?: string };

export async function saveKpiPay(userId: string, fiksa: number, kpiPercent: number): Promise<KpiPayState> {
  const s = await requireSession();
  if (getPermission(s.role, MODULES.SALARY) !== "FULL") return { error: "forbidden" };
  if (!userId) return { error: "invalid" };

  const f = parseMoney(fiksa);
  const b = parsePercent(kpiPercent) ?? 0;
  if (f === null || b === null) return { error: "invalid" };

  const before = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, fiksa: true, kpiPercent: true } });
  if (!before) return { error: "notfound" };

  await prisma.user.update({ where: { id: userId }, data: { fiksa: f, kpiPercent: b } });
  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "User",
    entityId: userId,
    oldValue: { fiksa: before.fiksa, kpiPercent: before.kpiPercent },
    newValue: { fiksa: f, kpiPercent: b },
    reason: `KPI to'lovi yangilandi (${before.fullName})`,
  });

  revalidatePath("/reports/kpi");
  revalidatePath("/users");
  return { ok: true };
}
