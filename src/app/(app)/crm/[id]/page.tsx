import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { canRead, canWrite, MODULES } from "@/lib/rbac";
import { ROLES } from "@/lib/constants";
import { branchWhere } from "@/lib/branchScope";
import { Forbidden } from "../../_components/ui";
import LeadDetail, { type DLead, type DActivity } from "./LeadDetail";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireSession();
  const t = getT(s.locale);
  if (!canRead(s.role, MODULES.CRM)) {
    return <Forbidden title={t("err.forbidden")} body={t("err.forbiddenBody")} />;
  }

  const [lead, managers, ids] = await Promise.all([
    prisma.lead.findUnique({
      where: { id },
      include: {
        manager: true,
        student: true,
        group: { select: { name: true, note: true, program: { select: { name: true } } } },
        branch: { select: { name: true } },
        activities: { include: { author: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.user.findMany({ where: { role: ROLES.OPERATOR, isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    prisma.lead.findMany({ where: branchWhere(s), orderBy: { createdAt: "desc" }, select: { id: true } }), // oldingi/keyingi — faol filial doirasida
  ]);
  if (!lead) notFound();

  const idx = ids.findIndex((x) => x.id === id);
  const prevId = idx > 0 ? ids[idx - 1].id : null;
  const nextId = idx >= 0 && idx < ids.length - 1 ? ids[idx + 1].id : null;

  const dlead: DLead = {
    id: lead.id,
    fullName: lead.fullName,
    phone: lead.phone,
    email: lead.email,
    source: lead.source,
    stage: lead.stage,
    interestCourse: lead.interestCourse,
    age: lead.age,
    level: lead.level,
    budget: lead.budget,
    note: lead.note,
    managerId: lead.managerId,
    managerName: lead.manager?.fullName ?? null,
    studentId: lead.studentId,
    groupId: lead.groupId,
    groupName: lead.group?.name ?? null,
    groupNote: lead.group?.note ?? null,
    branchName: lead.branch?.name ?? null,
    courseName: lead.group?.program?.name ?? null,
    enrollEditCount: lead.enrollEditCount,
    createdAt: lead.createdAt.toISOString(),
  };
  const activities: DActivity[] = lead.activities.map((a) => ({
    id: a.id,
    type: a.type,
    result: a.result,
    nextStepAt: a.nextStepAt ? a.nextStepAt.toISOString() : null,
    authorName: a.author?.fullName ?? null,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <LeadDetail
      lead={dlead}
      activities={activities}
      managers={managers.map((m) => ({ id: m.id, name: m.fullName }))}
      prevId={prevId}
      nextId={nextId}
      canWrite={canWrite(s.role, MODULES.CRM)}
      // Lidni butunlay o'chirish — direktor, o'rinbosari va administrator
      canDelete={[ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN].includes(s.role as never)}
      locale={s.locale}
    />
  );
}
