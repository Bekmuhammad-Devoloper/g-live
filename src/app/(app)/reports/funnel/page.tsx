import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { branchWhere } from "@/lib/branchScope";
import { Forbidden } from "../../_components/ui";
import LicenseBanner from "../../_components/LicenseBanner";
import FunnelDashboard, { type FLead } from "./FunnelDashboard";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ROP, ROLES.MANAGER, ROLES.ADMIN];

const p2 = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// Sotuv voronkasi — lidlar bo'yicha voronka analitikasi (hisobot jadvali + grafiklar).
export default async function FunnelPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim sotuv bo'limi uchun.", ru: "Этот раздел для отдела продаж.", en: "This section is for the sales department." })} />;
  }

  const leads = await prisma.lead.findMany({
    where: branchWhere(s), // faol filial doirasida
    orderBy: { createdAt: "desc" },
    select: {
      id: true, stage: true, source: true, interestCourse: true, createdAt: true,
      utmSource: true, managerId: true, manager: { select: { fullName: true } },
    },
  });

  const fleads: FLead[] = leads.map((l) => ({
    id: l.id,
    stage: l.stage,
    source: l.source,
    course: l.interestCourse,
    createdAt: l.createdAt.toISOString(),
    marketing: l.utmSource,
    managerId: l.managerId,
    managerName: l.manager?.fullName ?? null,
  }));

  const courses = Array.from(new Set(leads.map((l) => l.interestCourse).filter((x): x is string => !!x))).sort();
  const sources = Array.from(new Set(leads.map((l) => l.source).filter((x): x is string => !!x))).sort();
  const marketings = Array.from(new Set(leads.map((l) => l.utmSource).filter((x): x is string => !!x))).sort();
  const managers = Array.from(
    new Map(leads.filter((l) => l.managerId && l.manager).map((l) => [l.managerId!, l.manager!.fullName])).entries()
  ).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  const now = new Date();
  const defaultFrom = isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultTo = isoDay(now);

  return (
    <div>
      <LicenseBanner />
      <FunnelDashboard locale={s.locale} leads={fleads} courses={courses} sources={sources} marketings={marketings} managers={managers} defaultFrom={defaultFrom} defaultTo={defaultTo} />
    </div>
  );
}
