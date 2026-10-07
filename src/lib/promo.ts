import "server-only";
import { prisma } from "@/lib/db";

/** Promokodni bir xil ko'rinishga keltiradi: bo'shliqsiz, katta harflar */
export function normalizePromo(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

/** O'quvchi hozir nechta kursda o'qiydi — faol guruhlar soni (guruhdan chiqmagan) */
export async function activeCourseCount(studentId: string): Promise<number> {
  return prisma.groupStudent.count({ where: { studentId, isActive: true, leftAt: null } });
}

export type PromoCheck =
  | { ok: true; code: string; discount: number }
  | { ok: false; error: "promo_not_found" | "promo_inactive" | "promo_courses"; need?: number; have?: number };

/**
 * To'lovga promokod qo'llash mumkinmi. Bo'sh kod — promokodsiz to'lov (ok, chegirma 0).
 * Shart: kod mavjud, faol va o'quvchi kamida `minCourses` ta kursda o'qiydi.
 */
export async function checkPromoForStudent(rawCode: unknown, studentId: string, opts: { force?: boolean } = {}): Promise<PromoCheck> {
  const code = normalizePromo(rawCode);
  if (!code) return { ok: true, code: "", discount: 0 };
  const promo = await prisma.promoCode.findUnique({ where: { code } });
  if (!promo) return { ok: false, error: "promo_not_found" };
  if (!promo.isActive) return { ok: false, error: "promo_inactive" };
  // force — kassir ogohlantirishni ko'rib tasdiqlagan (o'quvchi boshqa kursda CRM'da hali guruhga qo'shilmagan bo'lishi mumkin)
  if (promo.minCourses && promo.minCourses > 1 && !opts.force) {
    const have = await activeCourseCount(studentId);
    if (have < promo.minCourses) return { ok: false, error: "promo_courses", need: promo.minCourses, have };
  }
  return { ok: true, code: promo.code, discount: promo.discount };
}

/** To'lov formalaridagi tanlov ro'yxati — faqat faol kodlar */
export async function activePromoOptions(): Promise<{ code: string; discount: number; minCourses: number | null; note: string | null }[]> {
  return prisma.promoCode.findMany({
    where: { isActive: true },
    select: { code: true, discount: true, minCourses: true, note: true },
    orderBy: [{ discount: "asc" }, { code: "asc" }],
  });
}
