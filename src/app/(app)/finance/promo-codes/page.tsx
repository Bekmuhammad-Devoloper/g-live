import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { branchViaStudent } from "@/lib/branchScope";
import { Forbidden } from "../../_components/ui";
import PromoCodesView, { type VPromo, type VPromoUse } from "./PromoCodesView";

// Promokodlar — direktor yaratadi; moliya ko'ra oladiganlar ro'yxat va foydalanishni ko'radi.
export default async function PromoCodesPage() {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.PAYMENTS)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsatingiz yo'q.", ru: "У вас нет доступа к этому разделу.", en: "You do not have permission for this section.", de: "Sie haben keine Berechtigung für diesen Bereich." })} />;
  }
  const canManage = s.role === ROLES.DIRECTOR || s.role === ROLES.DEPUTY_DIRECTOR;

  const [codes, usage, rows] = await Promise.all([
    prisma.promoCode.findMany({ orderBy: [{ isActive: "desc" }, { discount: "asc" }, { code: "asc" }] }),
    prisma.payment.groupBy({
      by: ["promoCode"],
      where: { promoCode: { not: null }, status: "PAID" },
      _count: { _all: true },
      _sum: { discount: true },
    }),
    prisma.payment.findMany({
      where: { AND: [{ promoCode: { not: null } }, { status: "PAID" }, branchViaStudent(s)] }, // faol filial doirasida
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, createdAt: true, promoCode: true, amount: true, discount: true, studentId: true, student: { select: { fullName: true } }, author: { select: { fullName: true } } },
    }),
  ]);

  const byCode = new Map(usage.map((u) => [u.promoCode ?? "", { uses: u._count._all, total: u._sum.discount ?? 0 }]));
  const promos: VPromo[] = codes.map((c) => ({
    id: c.id, code: c.code, discount: c.discount, minCourses: c.minCourses, note: c.note, isActive: c.isActive,
    uses: byCode.get(c.code)?.uses ?? 0, totalDiscount: byCode.get(c.code)?.total ?? 0, createdAt: c.createdAt.toISOString(),
  }));
  const uses: VPromoUse[] = rows.map((p) => ({
    id: p.id, date: p.createdAt.toISOString(), code: p.promoCode ?? "", student: p.student.fullName, studentId: p.studentId,
    amount: p.amount, discount: p.discount, author: p.author?.fullName ?? null,
  }));

  return <PromoCodesView locale={s.locale} promos={promos} uses={uses} canManage={canManage} />;
}
