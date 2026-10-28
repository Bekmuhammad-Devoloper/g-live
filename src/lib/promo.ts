import "server-only";
import { prisma } from "@/lib/db";

export function normalizePromo(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export async function activeCourseCount(studentId: string): Promise<number> {
  return prisma.groupStudent.count({ where: { studentId, isActive: true, leftAt: null } });
}

export type PromoCheck =
  | { ok: true; code: string; discount: number }
  | { ok: false; error: "promo_not_found" | "promo_inactive" | "promo_courses"; need?: number; have?: number };

export async function checkPromoForStudent(rawCode: unknown, studentId: string, opts: { force?: boolean } = {}): Promise<PromoCheck> {
  const code = normalizePromo(rawCode);
  if (!code) return { ok: true, code: "", discount: 0 };
  const promo = await prisma.promoCode.findUnique({ where: { code } });
  if (!promo) return { ok: false, error: "promo_not_found" };
  if (!promo.isActive) return { ok: false, error: "promo_inactive" };
  if (promo.minCourses && promo.minCourses > 1 && !opts.force) {
    const have = await activeCourseCount(studentId);
    if (have < promo.minCourses) return { ok: false, error: "promo_courses", need: promo.minCourses, have };
  }
  return { ok: true, code: promo.code, discount: promo.discount };
}

export async function activePromoOptions(): Promise<{ code: string; discount: number; minCourses: number | null; note: string | null }[]> {
  return prisma.promoCode.findMany({
    where: { isActive: true },
    select: { code: true, discount: true, minCourses: true, note: true },
    orderBy: [{ discount: "asc" }, { code: "asc" }],
  });
}
