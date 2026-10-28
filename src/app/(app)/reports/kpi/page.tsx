import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, canSeeTeamReports, getPermission, MODULES } from "@/lib/rbac";
import { ROLES, type Locale } from "@/lib/constants";
import { branchWhere, staffBranchWhere } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import KpiView from "./KpiView";
import type { Cat, VKpiRow } from "./KpiShared";

const BONUS = 200_000;
const DAY = 86_400_000;

const CAT: Record<string, Cat> = {
  [ROLES.MANAGER]: "operator",
  [ROLES.DEPUTY_DIRECTOR]: "rop",
  [ROLES.DIRECTOR]: "admin",
  [ROLES.ADMIN]: "admin",
};

interface Agg {
  total: number;
  won: number;
  blocked: number;
  wonMonth: number;
}

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

  const roles = [ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN];
  const [users, leads] = await Promise.all([
    prisma.user.findMany({
      where: { AND: [{ role: { in: roles }, isActive: true }, staffBranchWhere(s)] },
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        role: true,
        imageUrl: true,
        fiksa: true,
        kpiBonus: true,
        branchId: true,
        createdAt: true,
        lastLoginAt: true,
      },
    }),
    prisma.lead.findMany({
      where: { AND: [{ managerId: { not: null } }, branchWhere(s)] },
      select: { managerId: true, stage: true, createdAt: true },
    }),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const agg = new Map<string, Agg>();
  for (const u of users) agg.set(u.id, { total: 0, won: 0, blocked: 0, wonMonth: 0 });
  for (const l of leads) {
    const a = l.managerId ? agg.get(l.managerId) : undefined;
    if (!a) continue;
    a.total++;
    if (l.stage === "WON") {
      a.won++;
      if (l.createdAt >= monthStart) a.wonMonth++;
    } else if (l.stage === "LOST") {
      a.blocked++;
    }
  }

  const opsByBranch = new Map<string, string[]>();
  for (const u of users) {
    if (u.role !== ROLES.MANAGER || !u.branchId) continue;
    const list = opsByBranch.get(u.branchId);
    if (list) list.push(u.id);
    else opsByBranch.set(u.branchId, [u.id]);
  }

  const rows: VKpiRow[] = users.map((u) => {
    const cat = CAT[u.role] ?? "operator";

    let a = agg.get(u.id) ?? { total: 0, won: 0, blocked: 0, wonMonth: 0 };
    let opsCount = 0;
    if (cat === "rop") {
      const team = (u.branchId && opsByBranch.get(u.branchId)) || [];
      opsCount = team.length;
      const sum: Agg = { total: 0, won: 0, blocked: 0, wonMonth: 0 };
      for (const id of team) {
        const x = agg.get(id);
        if (!x) continue;
        sum.total += x.total;
        sum.won += x.won;
        sum.blocked += x.blocked;
        sum.wonMonth += x.wonMonth;
      }
      a = sum;
    }

    const conv = a.total > 0 ? Number(((a.won / a.total) * 100).toFixed(1)) : 0;
    const kpiPct = Math.min(100, Math.round(conv * 2));
    const bonus = u.kpiBonus ?? BONUS;
    const end = u.lastLoginAt ?? now;
    const workDays = Math.max(1, Math.ceil(Math.abs(end.getTime() - u.createdAt.getTime()) / DAY));

    return {
      id: u.id,
      name: u.fullName,
      cat,
      imageUrl: u.imageUrl,
      total: a.total,
      won: a.won,
      blocked: a.blocked,
      opsCount,
      conv,
      kpiPct,
      fiksa: u.fiksa,
      bonus,
      kpiMoney: a.won * bonus,
      wonMonth: a.wonMonth,
      earnedMonth: a.wonMonth * bonus,
      workDays,
    };
  });

  const canEdit = getPermission(s.role, MODULES.SALARY) === "FULL";
  return <KpiView rows={rows} locale={loc} canEdit={canEdit} />;
}
