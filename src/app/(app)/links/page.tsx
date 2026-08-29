import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, canWrite, MODULES } from "@/lib/rbac";
import { type Locale } from "@/lib/constants";
import { branchWhere } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import LinksView from "./LinksView";
import { PLATFORMS } from "./platforms";
import type { CountryOption, PlatformStat, VLink, VVacancy, VacancyOption } from "./types";

// Sanani serverda deterministik formatlaymiz (eski loyihadagi kabi: 09.08.2026).
const p2 = (n: number) => String(n).padStart(2, "0");
const dmy = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

export default async function LinksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const loc = s.locale as Locale;

  if (!canRead(s.role, MODULES.CRM)) {
    return (
      <Forbidden
        title={tr(loc, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })}
        body={tr(loc, { uz: "Bu bo'lim sotuv bo'limi uchun.", ru: "Этот раздел для отдела продаж.", en: "This section is for the sales department.", de: "Dieser Bereich ist für die Vertriebsabteilung." })}
      />
    );
  }
  const canManage = canWrite(s.role, MODULES.CRM);

  const rawVacancyId = sp?.vacancyId;
  const preselectVacancyId = (Array.isArray(rawVacancyId) ? rawVacancyId[0] : rawVacancyId) ?? null;

  const [vacancies, leadCounts] = await Promise.all([
    prisma.vacancy.findMany({
      where: branchWhere(s), // faol filial doirasida
      orderBy: { createdAt: "desc" },
      include: { links: { orderBy: { createdAt: "asc" } } },
    }),
    // "Arizalar" — Lead.vacancyLinkId orqali bog'langan lidlar soni (haqiqiy manba).
    prisma.lead.groupBy({
      by: ["vacancyLinkId"],
      where: { AND: [{ vacancyLinkId: { not: null } }, branchWhere(s)] }, // faol filial doirasida
      _count: { _all: true },
    }),
  ]);

  const appsByLink = new Map<string, number>();
  for (const row of leadCounts) {
    if (row.vacancyLinkId) appsByLink.set(row.vacancyLinkId, row._count._all);
  }

  const now = Date.now();

  const vlist: VVacancy[] = vacancies.map((v) => {
    const links: VLink[] = v.links.map((l) => {
      const expMs = l.expiresAt ? l.expiresAt.getTime() : null;
      const expired = expMs != null && expMs < now;
      const submissions = appsByLink.get(l.id) ?? 0;
      return {
        id: l.id,
        code: l.code,
        name: l.name,
        platform: l.platform,
        views: l.views,
        submissions,
        isActive: l.isActive,
        cvr: l.views > 0 ? Math.round((submissions / l.views) * 1000) / 10 : 0,
        expiresAt: l.expiresAt ? ymd(l.expiresAt) : null,
        expired,
        createdAt: dmy(l.createdAt),
      };
    });
    return {
      id: v.id,
      title: v.title,
      company: v.company,
      country: v.country,
      countryCode: v.countryCode,
      createdAt: dmy(v.createdAt),
      links,
      views: links.reduce((n, l) => n + l.views, 0),
      submissions: links.reduce((n, l) => n + l.submissions, 0),
      activeLinks: links.filter((l) => l.isActive && !l.expired).length,
    };
  });

  const allLinks = vlist.flatMap((v) => v.links);
  const totalViews = allLinks.reduce((n, l) => n + l.views, 0);
  const totalSubmissions = allLinks.reduce((n, l) => n + l.submissions, 0);
  const activeLinks = allLinks.filter((l) => l.isActive && !l.expired).length;

  // Platformalar kesimida statistika — faqat ma'lumot mavjud bo'lgan platformalar.
  const byPlat = new Map<string, { links: number; views: number; submissions: number }>();
  for (const l of allLinks) {
    const a = byPlat.get(l.platform) ?? { links: 0, views: 0, submissions: 0 };
    a.links++;
    a.views += l.views;
    a.submissions += l.submissions;
    byPlat.set(l.platform, a);
  }
  const platformStats: PlatformStat[] = PLATFORMS.filter((p) => byPlat.has(p.key)).map((p) => {
    const a = byPlat.get(p.key)!;
    return {
      key: p.key,
      label: p.label,
      color: p.color,
      icon: p.icon,
      links: a.links,
      views: a.views,
      submissions: a.submissions,
      sharePct: totalSubmissions > 0 ? Math.round((a.submissions / totalSubmissions) * 100) : 0,
    };
  });

  const countryMap = new Map<string, CountryOption>();
  for (const v of vlist) {
    if (v.country && !countryMap.has(v.country)) countryMap.set(v.country, { name: v.country, code: v.countryCode });
  }
  const countries = Array.from(countryMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  const vacancyOptions: VacancyOption[] = vlist.map((v) => ({ id: v.id, title: v.title, country: v.country, countryCode: v.countryCode }));

  // O'quv markaz kurslari — link yaratishda ro'yxatdan tanlash uchun
  const programs = await prisma.program.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const courseOptions = programs.map((p) => p.name);

  return (
    <LinksView
      locale={loc}
      vacancies={vlist}
      totals={{ totalLinks: allLinks.length, activeLinks, totalViews, totalSubmissions }}
      platformStats={platformStats}
      countries={countries}
      vacancyOptions={vacancyOptions}
      courseOptions={courseOptions}
      canManage={canManage}
      preselectVacancyId={preselectVacancyId}
    />
  );
}

export const dynamic = "force-dynamic";
