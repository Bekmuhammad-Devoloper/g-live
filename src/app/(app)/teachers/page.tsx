import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import TeachersView, { type VTeacher } from "./TeachersView";

const STAFF = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER, ROLES.ADMIN];

export default async function TeachersPage() {
  const s = await requireSession();
  if (!STAFF.includes(s.role as never)) {
    return (
      <Forbidden
        title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })}
        body={tr(s.locale, { uz: "Bu bo'lim rahbariyat uchun.", ru: "Этот раздел для руководства.", en: "This section is for management." })}
      />
    );
  }

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;

  const [teachers, branches] = await Promise.all([
    prisma.user.findMany({
      where: { role: ROLES.TEACHER },
      orderBy: { fullName: "asc" },
      // XAVFSIZLIK: select bilan faqat kerakli maydonlar — passwordHash/plainPassword hech qachon yuklanmaydi
      select: {
        id: true, fullName: true, phone: true, email: true, imageUrl: true,
        isActive: true, gender: true, fiksa: true, kpiBonus: true,
        branch: { select: { name: true } },
        teacherGroups: { select: { id: true, name: true, color: true, _count: { select: { students: true, lessons: true } } } },
        salaries: { select: { year: true, month: true, fiksa: true, bonus: true, penalty: true, kpi: true, closed: true }, orderBy: [{ year: "desc" }, { month: "desc" }] },
      },
    }),
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const vteachers: VTeacher[] = teachers.map((t) => {
    const groups = t.teacherGroups.map((g) => ({ id: g.id, name: g.name, color: g.color, students: g._count.students, lessons: g._count.lessons }));
    const cur = t.salaries.find((x) => x.year === curYear && x.month === curMonth);
    const bonus = cur?.bonus ?? 0;
    const penalty = cur?.penalty ?? 0;
    const kpi = t.kpiBonus; // KPI bonus = asosiy standart summa (fiksa kabi), User modelidan
    const total = t.fiksa + bonus + kpi - penalty;
    return {
      id: t.id,
      fullName: t.fullName,
      phone: t.phone,
      email: t.email,
      imageUrl: t.imageUrl,
      branch: t.branch?.name ?? null,
      active: t.isActive,
      gender: (t.gender === "MALE" || t.gender === "FEMALE" ? t.gender : null) as "MALE" | "FEMALE" | null,
      groups,
      totalStudents: groups.reduce((n, g) => n + g.students, 0),
      totalLessons: groups.reduce((n, g) => n + g.lessons, 0),
      fiksa: t.fiksa,
      kpi,
      bonus,
      penalty,
      monthTotal: total,
      history: t.salaries
        .filter((x) => !(x.year === curYear && x.month === curMonth))
        .map((x) => ({ year: x.year, month: x.month, fiksa: x.fiksa, bonus: x.bonus, penalty: x.penalty, kpi: x.kpi, total: x.fiksa + x.bonus + x.kpi - x.penalty, closed: x.closed })),
    };
  });

  const canManage = s.role === ROLES.DIRECTOR || s.role === ROLES.DEPUTY_DIRECTOR;

  return <TeachersView teachers={vteachers} canManage={canManage} locale={s.locale} branches={branches} />;
}
