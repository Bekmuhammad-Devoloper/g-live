"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ROLES, MAX_MONEY } from "@/lib/constants";
import { writeAudit } from "@/lib/audit";
import { normalizePromo } from "@/lib/promo";

// Promokodlarni faqat rahbariyat (direktor va o'rinbosar) yaratadi va boshqaradi
const CAN_MANAGE: string[] = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR];

export type PromoResult = { ok?: boolean; error?: string };

export async function savePromo(input: { id?: string | null; code: string; discount: number; minCourses?: number | null; note?: string | null }): Promise<PromoResult> {
  const s = await requireSession();
  if (!CAN_MANAGE.includes(s.role)) return { error: "forbidden" };

  const code = normalizePromo(input.code);
  if (!/^[A-Z0-9_-]{2,30}$/.test(code)) return { error: "code" };
  const discount = Math.trunc(Number(input.discount));
  if (!Number.isFinite(discount) || discount <= 0 || discount > MAX_MONEY) return { error: "discount" };
  const mc = Math.trunc(Number(input.minCourses));
  const minCourses = Number.isFinite(mc) && mc > 1 ? Math.min(mc, 20) : null;
  const note = String(input.note ?? "").trim().slice(0, 200) || null;

  const clash = await prisma.promoCode.findUnique({ where: { code }, select: { id: true } });
  if (clash && clash.id !== input.id) return { error: "exists" };

  if (input.id) {
    const prev = await prisma.promoCode.findUnique({ where: { id: input.id } });
    if (!prev) return { error: "notfound" };
    // Ishlatilgan kodning nomini o'zgartirib bo'lmaydi — to'lovlar tarixi eski nom bilan bog'langan
    if (prev.code !== code && (await prisma.payment.count({ where: { promoCode: prev.code } })) > 0) return { error: "used_rename" };
    await prisma.promoCode.update({ where: { id: input.id }, data: { code, discount, minCourses, note } });
    await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "PromoCode", entityId: input.id, oldValue: { code: prev.code, discount: prev.discount, minCourses: prev.minCourses }, newValue: { code, discount, minCourses, note } });
  } else {
    const row = await prisma.promoCode.create({ data: { code, discount, minCourses, note, createdById: s.userId } });
    await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "PromoCode", entityId: row.id, newValue: { code, discount, minCourses, note } });
  }
  revalidatePath("/finance/promo-codes");
  return { ok: true };
}

export async function setPromoActive(id: string, active: boolean): Promise<PromoResult> {
  const s = await requireSession();
  if (!CAN_MANAGE.includes(s.role)) return { error: "forbidden" };
  const row = await prisma.promoCode.update({ where: { id }, data: { isActive: active } }).catch(() => null);
  if (!row) return { error: "notfound" };
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "PromoCode", entityId: id, newValue: { code: row.code, isActive: active } });
  revalidatePath("/finance/promo-codes");
  return { ok: true };
}

/** O'chirish — faqat hech qachon ishlatilmagan kod. Ishlatilganini o'chirib qo'yish (faolsizlantirish) kerak. */
export async function deletePromo(id: string): Promise<PromoResult> {
  const s = await requireSession();
  if (!CAN_MANAGE.includes(s.role)) return { error: "forbidden" };
  const row = await prisma.promoCode.findUnique({ where: { id } });
  if (!row) return { error: "notfound" };
  if ((await prisma.payment.count({ where: { promoCode: row.code } })) > 0) return { error: "used" };
  await prisma.promoCode.delete({ where: { id } });
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "PromoCode", entityId: id, oldValue: { code: row.code, discount: row.discount } });
  revalidatePath("/finance/promo-codes");
  return { ok: true };
}
