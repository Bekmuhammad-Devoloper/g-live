import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { branchWhere, branchViaGroup } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { Card, HubCard, Badge, StatCard, Forbidden } from "../_components/ui";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.TEACHER];

export default async function EducationPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim o'quv bo'limi uchun.", ru: "Этот раздел для учебного отдела.", en: "This section is for the education department.", de: "Dieser Bereich ist für die Bildungsabteilung." })} />;
  }

  const [programs, groupsCount, onlineCount, contractsCount, assessmentsCount] = await Promise.all([
    // Dasturlar umumiy ma'lumotnoma, lekin guruh soni faol filial doirasida sanaladi
    prisma.program.findMany({ include: { levels: { orderBy: { order: "asc" } }, _count: { select: { groups: { where: branchWhere(s) } } } } }),
    // faol filial doirasida
    prisma.group.count({ where: { AND: [{ status: "ACTIVE" }, branchWhere(s)] } }),
    prisma.group.count({ where: { AND: [{ status: "ACTIVE", format: "ONLINE" }, branchWhere(s)] } }),
    prisma.contractTemplate.count(),
    // guruhsiz (umumiy) baholashlar hamma filialda ko'rinadi — faol filial doirasida
    prisma.seasonalAssessment.count({ where: s.branchId ? { OR: [branchViaGroup(s), { groupId: null }] } : {} }),
  ]);

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={tr(s.locale, { uz: "Dasturlar", ru: "Программы", en: "Programs", de: "Programme" })} value={programs.length} tone="brand" icon="book" />
        <StatCard label={tr(s.locale, { uz: "Faol guruhlar", ru: "Активные группы", en: "Active groups", de: "Aktive Gruppen" })} value={groupsCount} icon="layers" hint={tr(s.locale, { uz: `${onlineCount} ta onlayn`, ru: `${onlineCount} онлайн`, en: `${onlineCount} online`, de: `${onlineCount} online` })} />
        <StatCard label={tr(s.locale, { uz: "Shartnomalar", ru: "Договоры", en: "Contracts", de: "Verträge" })} value={contractsCount} icon="clipboard" />
        <StatCard label={tr(s.locale, { uz: "Mavsumiy baholash", ru: "Сезонное оценивание", en: "Seasonal assessment", de: "Saisonale Bewertung" })} value={assessmentsCount} icon="filecheck" />
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <HubCard href="/education/online" icon="video" title={tr(s.locale, { uz: "Onlayn kurslar", ru: "Онлайн-курсы", en: "Online courses", de: "Online-Kurse" })} desc={tr(s.locale, { uz: "Masofaviy o'tiladigan guruhlar va havolalar", ru: "Дистанционные группы и ссылки", en: "Remote groups and links", de: "Gruppen und Links für Fernunterricht" })} />
        <HubCard href="/education/offline" icon="building" title={tr(s.locale, { uz: "Offline kurslar", ru: "Офлайн-курсы", en: "Offline courses", de: "Offline-Kurse" })} desc={tr(s.locale, { uz: "Auditoriyada o'tiladigan guruhlar", ru: "Группы в аудитории", en: "In-classroom groups", de: "Gruppen im Unterrichtsraum" })} />
        <HubCard href="/education/assessment" icon="filecheck" title={tr(s.locale, { uz: "Mavsumiy baholash", ru: "Сезонное оценивание", en: "Seasonal assessment", de: "Saisonale Bewertung" })} desc={tr(s.locale, { uz: "Fasl/chorak bo'yicha davriy baholash", ru: "Периодическое оценивание по сезонам/четвертям", en: "Periodic assessment by season/quarter", de: "Regelmäßige Bewertung nach Saison/Quartal" })} />
        <HubCard href="/education/contract" icon="clipboard" title={tr(s.locale, { uz: "Shartnomalar", ru: "Договоры", en: "Contracts", de: "Verträge" })} desc={tr(s.locale, { uz: "O'quv shartnomalari va holati", ru: "Учебные договоры и их статус", en: "Education contracts and their status", de: "Bildungsverträge und ihr Status" })} />
      </div>

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-slate-700">{tr(s.locale, { uz: "O'quv dasturlari va darajalar", ru: "Учебные программы и уровни", en: "Education programs and levels", de: "Bildungsprogramme und Niveaus" })}</h3>
        {programs.length === 0 ? (
          <p className="text-sm text-slate-400">{tr(s.locale, { uz: "Dastur yo'q", ru: "Программ нет", en: "No programs", de: "Keine Programme" })}</p>
        ) : (
          <div className="space-y-4">
            {programs.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-200/70 p-4 dark:border-slate-800">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-800">{p.name}</div>
                    {p.description && <div className="text-xs text-slate-500">{p.description}</div>}
                  </div>
                  <div className="flex gap-1.5">
                    <Badge tone="brand">{p._count.groups} {tr(s.locale, { uz: "guruh", ru: "групп", en: "groups", de: "Gruppen" })}</Badge>
                    <Badge tone="slate">{p.gradingType}</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.levels.map((l) => (
                    <div key={l.id} className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs dark:bg-slate-800">
                      <span className="font-semibold text-slate-700">{l.code}</span>
                      <span className="text-slate-400">
                        {" · "}{l.weeks ?? "—"} {tr(s.locale, { uz: "hafta", ru: "нед.", en: "weeks", de: "Wochen" })} · {l.academicHours ?? "—"} {tr(s.locale, { uz: "soat", ru: "ч.", en: "h", de: "Std." })} · {tr(s.locale, { uz: "o'tish", ru: "проходной", en: "pass", de: "Bestehen" })} {l.passScore ?? "—"}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
