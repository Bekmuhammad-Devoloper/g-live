import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import VacanciesView, { type VVacancy } from "./VacanciesView";

const CAN = [ROLES.ROP, ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN];

const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;

export default async function VacanciesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await requireSession();
  if (!CAN.includes(s.role as never)) {
    return (
      <Forbidden
        title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })}
        body={tr(s.locale, { uz: "Bu bo'lim savdo bo'limi uchun.", ru: "Этот раздел для отдела продаж.", en: "This section is for the sales department." })}
      />
    );
  }
  const sp = await searchParams;

  const vacancies = await prisma.vacancy.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, company: true, country: true, countryCode: true,
      jobTitle: true, salary: true, description: true, isActive: true,
      createdAt: true, createdByName: true,
      links: { select: { id: true, views: true, submissions: true, isActive: true, platform: true } },
    },
  });

  // Arizalar — lidlarning vacancyLinkId si bo'yicha (haqiqiy hisob)
  const grouped = await prisma.lead.groupBy({
    by: ["vacancyLinkId"],
    where: { vacancyLinkId: { not: null } },
    _count: { _all: true },
  });
  const appsByLink = new Map(grouped.map((g) => [g.vacancyLinkId as string, g._count._all]));

  const rows: VVacancy[] = vacancies.map((v) => {
    const apps = v.links.reduce((n, l) => n + (appsByLink.get(l.id) ?? 0), 0);
    return {
      id: v.id,
      title: v.title,
      company: v.company,
      country: v.country,
      countryCode: v.countryCode,
      jobTitle: v.jobTitle,
      salary: v.salary,
      description: v.description,
      isActive: v.isActive,
      createdAt: fmtDate(v.createdAt),
      createdByName: v.createdByName,
      linkCount: v.links.length,
      activeLinks: v.links.filter((l) => l.isActive).length,
      views: v.links.reduce((n, l) => n + l.views, 0),
      applications: apps,
      platforms: Array.from(new Set(v.links.map((l) => l.platform))),
    };
  });

  const stats = {
    total: rows.length,
    active: rows.filter((r) => r.isActive).length,
    withLinks: rows.filter((r) => r.linkCount > 0).length,
    views: rows.reduce((n, r) => n + r.views, 0),
    applications: rows.reduce((n, r) => n + r.applications, 0),
  };

  return <VacanciesView locale={s.locale as Locale} rows={rows} stats={stats} openNew={sp.new === "1"} />;
}

export const dynamic = "force-dynamic";
