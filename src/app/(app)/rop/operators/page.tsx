import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, canWrite, MODULES } from "@/lib/rbac";
import { ROLES, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import OperatorsMonitor, { type VOperator } from "./OperatorsMonitor";

// ROP → Operatorlar command-center (monitoring). O'quv markaz sotuv menejerlari.
export default async function RopOperatorsPage() {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.REPORTS) && !canRead(s.role, MODULES.CRM)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim savdo bo'limi uchun.", ru: "Этот раздел для отдела продаж.", en: "This section is for the sales department." })} />;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [operators, leads, calls] = await Promise.all([
    prisma.user.findMany({
      where: { role: ROLES.OPERATOR, isActive: true },
      select: { id: true, fullName: true, phone: true, imageUrl: true, lastLoginAt: true, createdAt: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.lead.findMany({ where: { managerId: { not: null } }, orderBy: { createdAt: "desc" }, select: { managerId: true, stage: true, fullName: true } }),
    prisma.call.findMany({ where: { operatorId: { not: null } }, select: { operatorId: true, duration: true, startedAt: true } }),
  ]);

  const ONLINE_MS = 15 * 60 * 1000;
  const rows: VOperator[] = operators.map((op) => {
    const mine = leads.filter((l) => l.managerId === op.id);
    const won = mine.filter((l) => l.stage === "WON").length;
    const myCalls = calls.filter((c) => c.operatorId === op.id);
    const todayCalls = myCalls.filter((c) => c.startedAt >= todayStart).length;
    const talkMin = Math.round(myCalls.reduce((n, c) => n + c.duration, 0) / 60);
    const online = !!op.lastLoginAt && now.getTime() - op.lastLoginAt.getTime() < ONLINE_MS;
    return {
      id: op.id,
      name: op.fullName,
      phone: op.phone ?? "",
      imageUrl: op.imageUrl,
      todayCalls,
      talkMin,
      total: mine.length,
      won,
      conv: mine.length ? Math.round((won / mine.length) * 100) : 0,
      online,
      lastOnline: op.lastLoginAt ? op.lastLoginAt.toISOString() : null,
      lastLead: mine[0]?.fullName ?? null,
      createdAt: op.createdAt.toISOString(),
    };
  });

  return (
    <OperatorsMonitor
      operators={rows}
      totalLeads={leads.length}
      todayCalls={calls.filter((c) => c.startedAt >= todayStart).length}
      writable={canWrite(s.role, MODULES.USERS)}
      locale={s.locale as Locale}
    />
  );
}
