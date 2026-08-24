import type { Prisma } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES, SEASON_LABELS, ASSESSMENT_STATUS_LABELS, label } from "@/lib/constants";
import { branchWhere, branchViaGroup, branchViaStudent } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { Card, StatCard, Table, EmptyRow, Badge, Forbidden } from "../../_components/ui";
import AssessmentControls from "./AssessmentControls";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.TEACHER];

const statusTone: Record<string, "green" | "amber" | "slate"> = {
  COMPLETED: "green",
  ONGOING: "amber",
  PLANNED: "slate",
};

export default async function AssessmentPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim o'quv bo'limi uchun.", ru: "Этот раздел для учебного отдела.", en: "This section is for the education department." })} />;
  }
  const isTeacher = s.role === ROLES.TEACHER;

  // O'qituvchi faqat o'z guruhi va umumiy baholashlarni ko'radi
  const roleWhere: Prisma.SeasonalAssessmentWhereInput = isTeacher
    ? { OR: [{ group: { teacherId: s.userId } }, { groupId: null }] }
    : {};
  // faol filial doirasida (guruhsiz — umumiy — baholashlar hamma filialda ko'rinadi)
  const branchCond: Prisma.SeasonalAssessmentWhereInput = s.branchId
    ? { OR: [branchViaGroup(s), { groupId: null }] }
    : {};
  const where: Prisma.SeasonalAssessmentWhereInput = { AND: [roleWhere, branchCond] };

  const [assessments, completed, resultsAgg, recentResults, groups] = await Promise.all([
    prisma.seasonalAssessment.findMany({
      where,
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
      include: { group: { select: { name: true } }, _count: { select: { results: true } } },
    }),
    prisma.seasonalAssessment.count({ where: { ...where, status: "COMPLETED" } }),
    // natijalar o'quvchi orqali faol filial doirasida
    prisma.seasonalResult.aggregate({ where: branchViaStudent(s), _avg: { score: true }, _count: true }),
    prisma.seasonalResult.findMany({
      where: branchViaStudent(s), // faol filial doirasida
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { student: { select: { fullName: true } }, assessment: { select: { title: true, passScore: true } } },
    }),
    // faol filial doirasida
    isTeacher
      ? prisma.group.findMany({ where: { AND: [{ teacherId: s.userId }, branchWhere(s)] }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : prisma.group.findMany({ where: branchWhere(s), select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const avg = resultsAgg._avg.score != null ? Math.round(resultsAgg._avg.score) : 0;
  const fmtDate = (d: Date | null) =>
    d ? new Intl.DateTimeFormat(s.locale === "ru" ? "ru-RU" : "uz-UZ").format(d) : "—";

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={tr(s.locale, { uz: "Baholashlar", ru: "Оценивания", en: "Assessments" })} value={assessments.length} tone="brand" icon="filecheck" />
        <StatCard label={tr(s.locale, { uz: "Yakunlangan", ru: "Завершено", en: "Completed" })} value={completed} tone="green" icon="check" />
        <StatCard label={tr(s.locale, { uz: "Natijalar", ru: "Результаты", en: "Results" })} value={resultsAgg._count} icon="chart" />
        <StatCard label={tr(s.locale, { uz: "O'rtacha ball", ru: "Средний балл", en: "Average score" })} value={avg} icon="trophy" />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{tr(s.locale, { uz: "Mavsumiy baholashlar", ru: "Сезонные оценивания", en: "Seasonal assessments" })}</h3>
        <AssessmentControls groups={groups} locale={s.locale} />
      </div>

      <Card padded={false}>
        <Table
          head={
            <tr>
              <th className="px-4 py-3 w-12">№</th>
              <th className="px-4 py-3">{tr(s.locale, { uz: "Nomi", ru: "Название", en: "Name" })}</th>
              <th className="px-4 py-3">{tr(s.locale, { uz: "Mavsum", ru: "Сезон", en: "Season" })}</th>
              <th className="px-4 py-3">{tr(s.locale, { uz: "Guruh", ru: "Группа", en: "Group" })}</th>
              <th className="px-4 py-3">{tr(s.locale, { uz: "Daraja", ru: "Уровень", en: "Level" })}</th>
              <th className="px-4 py-3">{tr(s.locale, { uz: "Sana", ru: "Дата", en: "Date" })}</th>
              <th className="px-4 py-3">{tr(s.locale, { uz: "Natijalar", ru: "Результаты", en: "Results" })}</th>
              <th className="px-4 py-3">{tr(s.locale, { uz: "Holat", ru: "Статус", en: "Status" })}</th>
            </tr>
          }
        >
          {assessments.length === 0 ? (
            <EmptyRow colSpan={8} text={tr(s.locale, { uz: "Baholash qo'shilmagan", ru: "Оценивания не добавлены", en: "No assessments added" })} />
          ) : (
            assessments.map((a, i) => (
              <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-slate-800">
                  {a.title}
                  {a.skill && a.skill !== "GENERAL" && <span className="ml-2 text-xs text-slate-400">{a.skill}</span>}
                </td>
                <td className="px-4 py-3">
                  <Badge tone="blue">{label(SEASON_LABELS, a.season, s.locale)} {a.year}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{a.group?.name ?? tr(s.locale, { uz: "Umumiy", ru: "Общее", en: "General" })}</td>
                <td className="px-4 py-3 text-slate-500">{a.levelCode ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{fmtDate(a.date)}</td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-brand-500/15 px-2 py-0.5 text-xs font-bold text-brand-600 dark:text-brand-300">{a._count.results}</span>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone[a.status] ?? "slate"}>{label(ASSESSMENT_STATUS_LABELS, a.status, s.locale)}</Badge>
                </td>
              </tr>
            ))
          )}
        </Table>
      </Card>

      {recentResults.length > 0 && (
        <Card padded={false} className="mt-5">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-700">{tr(s.locale, { uz: "Oxirgi natijalar", ru: "Последние результаты", en: "Latest results" })}</h3>
          </div>
          <Table
            head={
              <tr>
                <th className="px-4 py-3">{tr(s.locale, { uz: "O'quvchi", ru: "Ученик", en: "Student" })}</th>
                <th className="px-4 py-3">{tr(s.locale, { uz: "Baholash", ru: "Оценивание", en: "Assessment" })}</th>
                <th className="px-4 py-3">{tr(s.locale, { uz: "Ball", ru: "Балл", en: "Score" })}</th>
                <th className="px-4 py-3">{tr(s.locale, { uz: "Natija", ru: "Результат", en: "Result" })}</th>
              </tr>
            }
          >
            {recentResults.map((r) => {
              const passed = r.passed ?? (r.score != null ? r.score >= r.assessment.passScore : null);
              return (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.student.fullName}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.assessment.title}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{r.score ?? "—"}{r.grade ? ` (${r.grade})` : ""}</td>
                  <td className="px-4 py-3">
                    {passed === null ? <Badge tone="slate">—</Badge> : passed ? <Badge tone="green">{tr(s.locale, { uz: "O'tdi", ru: "Сдал", en: "Passed" })}</Badge> : <Badge tone="red">{tr(s.locale, { uz: "O'tmadi", ru: "Не сдал", en: "Failed" })}</Badge>}
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>
      )}
    </>
  );
}
