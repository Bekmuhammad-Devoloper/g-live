import { collectionsByAuthorMonth, commissionByManagerMonth, commissionOf, leadOwners, monthCommission, salesOwnerByStudent, totalCommission } from "@/lib/salesCommission";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canSeeTeamReports, getPermission, MODULES } from "@/lib/rbac";
import { ROLES, type Locale } from "@/lib/constants";
import { staffBranchWhere } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import KpiView from "./KpiView";
import type { Cat, VKpiRow } from "./KpiShared";

const DAY = 86_400_000;

const CAT: Record<string, Cat> = {
  [ROLES.OPERATOR]: "operator",
  [ROLES.MANAGER]: "operator",
  [ROLES.ROP]: "rop",
  [ROLES.DEPUTY_DIRECTOR]: "admin",
  [ROLES.DIRECTOR]: "admin",
  [ROLES.ADMIN]: "admin",
};

export default async function KpiPage() {
  const s = await requireSession();
  const loc = s.locale as Locale;
  if (!canSeeTeamReports(s.role)) {
    return (
      <Forbidden
        title={tr(loc, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })}
        body={tr(loc, { uz: "Bu bo'lim savdo bo'limi uchun.", ru: "Этот раздел для отдела продаж.", en: "This section is for the sales department.", de: "Dieser Bereich ist für die Vertriebsabteilung." })}
      />
    );
  }

  const users = await prisma.user.findMany({
    where: { AND: [{ role: { in: Object.keys(CAT) }, isActive: true }, staffBranchWhere(s)] },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, role: true, imageUrl: true, fiksa: true, kpiPercent: true, collectPercent: true, branchId: true, createdAt: true, lastLoginAt: true },
  });
  const ids = users.map((u) => u.id);
  const [owned, studentOwners] = await Promise.all([leadOwners(), salesOwnerByStudent()]);
  const [commissions, collections] = await Promise.all([
    commissionByManagerMonth(ids, studentOwners),
    collectionsByAuthorMonth(users.filter((u) => u.role === ROLES.ADMIN).map((u) => u.id)),
  ]);
  const now = new Date();

  const handled = new Map<string, { total: number; blocked: number }>();
  for (const id of ids) handled.set(id, { total: 0, blocked: 0 });
  for (const l of owned) {
    const h = l.ownerId ? handled.get(l.ownerId) : undefined;
    if (!h) continue;
    h.total++;
    if (l.stage === "LOST") h.blocked++;
  }
  for (const o of studentOwners.values()) {
    if (!o.until) continue;
    const h = handled.get(o.ownerId);
    if (h) h.total++;
  }

  const teamSize = new Map<string, number>();
  for (const u of users) if ((u.role === ROLES.OPERATOR || u.role === ROLES.MANAGER) && u.branchId) teamSize.set(u.branchId, (teamSize.get(u.branchId) ?? 0) + 1);

  const rows: VKpiRow[] = users.map((u) => {
    const cat = CAT[u.role] ?? "operator";
    const h = handled.get(u.id) ?? { total: 0, blocked: 0 };
    const pct = u.kpiPercent ?? 0;
    const cpct = u.role === ROLES.ADMIN ? u.collectPercent ?? 0 : 0;
    const all = totalCommission(commissions, u.id);
    const month = monthCommission(commissions, u.id, now);
    const cAll = totalCommission(collections, u.id);
    const cMonth = monthCommission(collections, u.id, now);
    const total = Math.max(h.total, all.students);
    const conv = total > 0 ? Number(((all.students / total) * 100).toFixed(1)) : 0;
    const end = u.lastLoginAt ?? now;
    const workDays = Math.max(1, Math.ceil(Math.abs(end.getTime() - u.createdAt.getTime()) / DAY));

    return {
      id: u.id,
      name: u.fullName,
      cat,
      role: u.role,
      imageUrl: u.imageUrl,
      total,
      won: all.students,
      blocked: h.blocked,
      opsCount: cat === "rop" && u.branchId ? teamSize.get(u.branchId) ?? 0 : 0,
      conv,
      kpiPct: Math.min(100, Math.round(conv * 2)),
      fiksa: u.fiksa,
      bonus: pct,
      collectPct: cpct,
      kpiMoney: commissionOf(all.base, pct) + commissionOf(cAll.base, cpct),
      paidAll: all.students,
      collCountAll: cAll.students,
      wonMonth: month.students,
      paidMonth: month.students,
      baseMonth: month.base,
      collCountMonth: cMonth.students,
      collBaseMonth: cMonth.base,
      earnedMonth: commissionOf(month.base, pct) + commissionOf(cMonth.base, cpct),
      workDays,
    };
  });

  const canEdit = getPermission(s.role, MODULES.SALARY) === "FULL";
  return <KpiView rows={rows} locale={loc} canEdit={canEdit} />;
}
