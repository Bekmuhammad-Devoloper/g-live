"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { writeAudit } from "@/lib/audit";

const CAN = [ROLES.DIRECTOR, ROLES.ADMIN, ROLES.DEPUTY_DIRECTOR];

// Operatorni ROP (savdo bo'limi rahbari) qilib belgilash yoki bekor qilish.
export async function setRop(userId: string, isRop: boolean): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!CAN.includes(s.role as never)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission" }) };
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!u || u.role !== ROLES.OPERATOR) return { error: tr(s.locale, { uz: "Faqat operatorni ROP qilish mumkin", ru: "РОП можно назначить только оператора", en: "Only an operator can be made ROP" }) };
  await prisma.user.update({ where: { id: userId }, data: { position: isRop ? "ROP" : null } });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "User", entityId: userId, newValue: { position: isRop ? "ROP" : "Operator" } });
  revalidatePath("/reports/sales-team");
  return { ok: true };
}
