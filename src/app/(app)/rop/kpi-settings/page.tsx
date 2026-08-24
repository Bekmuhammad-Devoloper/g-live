import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import { ROLES, type Locale } from "@/lib/constants";
import { branchWhere } from "@/lib/branchScope";
import { getSetting } from "@/lib/settings";
import { Forbidden } from "../../_components/ui";
import KpiSettingsView, { type VRatingRow } from "./KpiSettingsView";
import { DEFAULT_KPI, kpiSettingsSchema, type RopKpiSettings } from "./schema";

const MANAGE = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];

// ROP → KPI Sozlamalari: baholash parametrlari + oylik to'lov + operatorlar reytingi.
export default async function RopKpiSettingsPage() {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.REPORTS) && !canRead(s.role, MODULES.CRM)) {
    return <Forbidden title="Kirish taqiqlangan" body="Bu bo'lim savdo bo'limi uchun." />;
  }

  const [raw, operators, leads] = await Promise.all([
    getSetting("rop.kpi"),
    // faol filial doirasida
    prisma.user.findMany({ where: { AND: [{ role: ROLES.OPERATOR, isActive: true }, branchWhere(s)] }, select: { id: true, fullName: true, kpiBonus: true }, orderBy: { fullName: "asc" } }),
    // faol filial doirasida
    prisma.lead.findMany({ where: { AND: [{ managerId: { not: null } }, branchWhere(s)] }, select: { managerId: true, stage: true } }),
  ]);

  let settings: RopKpiSettings = DEFAULT_KPI;
  if (raw) {
    try { const p = kpiSettingsSchema.safeParse(JSON.parse(raw)); if (p.success) settings = p.data; } catch { /* default */ }
  }

  const rating: VRatingRow[] = operators
    .map((op) => {
      const mine = leads.filter((l) => l.managerId === op.id);
      const won = mine.filter((l) => l.stage === "WON").length;
      const rejected = mine.filter((l) => l.stage === "LOST").length;
      const conv = mine.length ? Math.round((won / mine.length) * 100) : 0;
      return { id: op.id, name: op.fullName, total: mine.length, won, rejected, conv, kpi: conv, pay: won * (op.kpiBonus ?? 200000) };
    })
    .sort((a, b) => b.conv - a.conv || b.won - a.won);

  return (
    <KpiSettingsView
      settings={settings}
      rating={rating}
      canManage={MANAGE.includes(s.role as never)}
      locale={s.locale as Locale}
    />
  );
}
