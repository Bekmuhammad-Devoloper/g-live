import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { tr } from "@/lib/tr";
import { canRead, getPermission, MODULES } from "@/lib/rbac";
import { ROLES } from "@/lib/constants";
import { PageHeader, Card, StatCard, Forbidden } from "../_components/ui";
import SalaryWorkspace, { type SalaryRow } from "./SalaryWorkspace";

export default async function SalaryPage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string }> }) {
  const s = await requireSession();
  const t = getT(s.locale);

  if (!canRead(s.role, MODULES.SALARY)) {
    return <Forbidden title={t("err.forbidden")} body={t("err.forbiddenBody")} />;
  }

  // O'qituvchi — o'z yuklamasi bo'yicha dastlabki ma'lumot
  if (s.role === ROLES.TEACHER) {
    const groups = await prisma.group.findMany({
      where: { teacherId: s.userId },
      include: { _count: { select: { students: true, lessons: true } } },
    });
    const lessons = groups.reduce((n, g) => n + g._count.lessons, 0);
    const students = groups.reduce((n, g) => n + g._count.students, 0);
    return (
      <>
        <PageHeader title={t("nav.salary")} subtitle={tr(s.locale, { uz: "Dastlabki yuklama (tasdiqlanmagan hisob)", ru: "Предварительная нагрузка (неутверждённый расчёт)", en: "Preliminary workload (unconfirmed calculation)" })} />
        <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label={tr(s.locale, { uz: "Guruhlarim", ru: "Мои группы", en: "My groups" })} value={groups.length} tone="brand" icon="book" />
          <StatCard label={tr(s.locale, { uz: "O'tilgan darslar", ru: "Проведённые занятия", en: "Lessons held" })} value={lessons} icon="check" />
          <StatCard label={tr(s.locale, { uz: "O'quvchilar", ru: "Ученики", en: "Students" })} value={students} icon="users" />
        </div>
        <Card>
          <p className="text-sm text-slate-500">
            ℹ️ {tr(s.locale, {
              uz: "Ish haqi formulalari (stavka, akademik soat, bonus/ushlanma) TZ bo'yicha 2-bosqichda sozlanadi. Bu yerda faqat dastlabki yuklama ko'rsatilgan; yakuniy hisobni buxgalter/direktor o'rinbosari tasdiqlaydi.",
              ru: "Формулы расчёта зарплаты (ставка, академический час, бонус/удержание) настраиваются на 2-м этапе по ТЗ. Здесь показана только предварительная нагрузка; итоговый расчёт утверждает бухгалтер/зам. директора.",
              en: "Salary formulas (rate, academic hour, bonus/deduction) are configured in phase 2 per the spec. Only the preliminary workload is shown here; the final calculation is confirmed by the accountant/deputy director.",
            })}
          </p>
        </Card>
      </>
    );
  }

  // Direktor / o'rinbosar — davr bo'yicha ish haqi hisob-kitobi
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.year) || now.getFullYear();
  const monthRaw = Number(sp.month) || now.getMonth() + 1;
  const month = Math.min(12, Math.max(1, monthRaw));

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const teachers = await prisma.user.findMany({
    where: { role: ROLES.TEACHER, isActive: true },
    select: { id: true, fullName: true, fiksa: true, kpiBonus: true },
    orderBy: { fullName: "asc" },
  });
  const teacherIds = teachers.map((tc) => tc.id);

  const groups = await prisma.group.findMany({
    where: { teacherId: { in: teacherIds } },
    select: { id: true, teacherId: true },
  });
  const groupToTeacher = new Map(groups.map((g) => [g.id, g.teacherId!]));
  const groupIds = groups.map((g) => g.id);

  const [lessonRows, studentRows, salaries] = await Promise.all([
    groupIds.length
      ? prisma.lesson.groupBy({ by: ["groupId"], where: { groupId: { in: groupIds }, startsAt: { gte: monthStart, lt: monthEnd } }, _count: { _all: true } })
      : Promise.resolve([] as { groupId: string; _count: { _all: number } }[]),
    groupIds.length
      ? prisma.groupStudent.groupBy({ by: ["groupId"], where: { groupId: { in: groupIds }, isActive: true }, _count: { _all: true } })
      : Promise.resolve([] as { groupId: string; _count: { _all: number } }[]),
    prisma.teacherSalary.findMany({ where: { teacherId: { in: teacherIds }, year, month } }),
  ]);

  const lessonByTeacher = new Map<string, number>();
  for (const r of lessonRows) {
    const tid = groupToTeacher.get(r.groupId);
    if (tid) lessonByTeacher.set(tid, (lessonByTeacher.get(tid) ?? 0) + r._count._all);
  }
  const studentByTeacher = new Map<string, number>();
  for (const r of studentRows) {
    const tid = groupToTeacher.get(r.groupId);
    if (tid) studentByTeacher.set(tid, (studentByTeacher.get(tid) ?? 0) + r._count._all);
  }
  const salaryByTeacher = new Map(salaries.map((r) => [r.teacherId, r]));

  const rows: SalaryRow[] = teachers.map((tc) => {
    const rec = salaryByTeacher.get(tc.id);
    return {
      teacherId: tc.id,
      name: tc.fullName,
      fiksa: rec?.fiksa ?? tc.fiksa,
      lessons: rec?.lessons ?? lessonByTeacher.get(tc.id) ?? 0,
      students: rec?.students ?? studentByTeacher.get(tc.id) ?? 0,
      bonus: rec?.bonus ?? 0,
      penalty: rec?.penalty ?? 0,
      kpi: rec?.kpi ?? tc.kpiBonus,
      net: rec ? rec.fiksa + rec.bonus + rec.kpi - rec.penalty : tc.fiksa + tc.kpiBonus,
      hasRecord: !!rec,
      closed: rec?.closed ?? false,
    };
  });

  const canManage = getPermission(s.role, MODULES.SALARY) === "FULL";

  return (
    <>
      <PageHeader title={t("nav.salary")} subtitle={tr(s.locale, { uz: "Ish haqi hisob-kitobi (davr bo'yicha)", ru: "Расчёт зарплаты (по периоду)", en: "Salary calculation (by period)" })} />
      <SalaryWorkspace year={year} month={month} rows={rows} canManage={canManage} locale={s.locale} />
    </>
  );
}
