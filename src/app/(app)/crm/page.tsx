import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { canRead, canWrite, MODULES } from "@/lib/rbac";
import { ROLES } from "@/lib/constants";
import { Forbidden } from "../_components/ui";
import LeadsWorkspace from "./_components/LeadsWorkspace";
import { columnOf, type VLead } from "./_lib/leadColumns";
import type { Analytics } from "./_components/AnalyticsTiles";

export default async function CrmPage() {
  const s = await requireSession();
  const t = getT(s.locale);
  if (!canRead(s.role, MODULES.CRM)) {
    return <Forbidden title={t("err.forbidden")} body={t("err.forbiddenBody")} />;
  }

  const [leads, managers] = await Promise.all([
    prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      include: { manager: true, _count: { select: { activities: true } } },
      take: 2000,
    }),
    prisma.user.findMany({ where: { role: ROLES.OPERATOR, isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  ]);

  const vleads: VLead[] = leads.map((l) => ({
    id: l.id,
    fullName: l.fullName,
    phone: l.phone,
    email: l.email,
    source: l.source,
    stage: l.stage,
    interestCourse: l.interestCourse,
    budget: l.budget,
    note: l.note,
    managerId: l.managerId,
    managerName: l.manager?.fullName ?? null,
    studentId: l.studentId,
    activityCount: l._count.activities,
    lastActivity: null,
    createdAt: l.createdAt.toISOString(),
  }));

  // Analitika
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const y0 = t0 - 86400000;
  const byColumn: Record<string, number> = {};
  for (const l of vleads) byColumn[columnOf(l.stage)] = (byColumn[columnOf(l.stage)] ?? 0) + 1;
  const won = vleads.filter((l) => ["PAID", "WON"].includes(l.stage)).length;
  const analytics: Analytics = {
    total: vleads.length,
    newToday: vleads.filter((l) => new Date(l.createdAt).getTime() >= t0).length,
    newYesterday: vleads.filter((l) => { const ts = new Date(l.createdAt).getTime(); return ts >= y0 && ts < t0; }).length,
    byColumn,
    conversion: vleads.length ? Math.round((won / vleads.length) * 100) : 0,
  };

  const sources = [...new Set(vleads.map((l) => l.source).filter((x): x is string => !!x))];

  return (
    <LeadsWorkspace
      locale={s.locale}
      initialLeads={vleads}
      managers={managers.map((m) => ({ id: m.id, name: m.fullName }))}
      sources={sources}
      analytics={analytics}
      canWrite={canWrite(s.role, MODULES.CRM)}
    />
  );
}
