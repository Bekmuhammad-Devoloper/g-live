import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { branchWhere } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import GroupStudentsView, { type VGroupStudent } from "./GroupStudentsView";
import type { Prisma } from "@prisma/client";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER, ROLES.ADMIN, ROLES.TEACHER];

const p2 = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

export default async function GroupStudentsPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim xodimlar uchun.", ru: "Этот раздел только для сотрудников.", en: "This section is for staff only." })} />;
  }

  // O'qituvchi faqat o'z guruhlaridagi o'quvchilarni ko'radi
  let where: Prisma.StudentWhereInput = {};
  if (s.role === ROLES.TEACHER) {
    where = { enrollments: { some: { group: { teacherId: s.userId } } } };
  }
  // faol filial doirasida
  where = { AND: [where, branchWhere(s)] };

  const students = await prisma.student.findMany({
    where,
    orderBy: { fullName: "asc" },
    include: {
      enrollments: { include: { group: { include: { teacher: { select: { fullName: true } } } } } },
    },
  });

  const vstudents: VGroupStudent[] = students.map((st) => {
    const joinDates = st.enrollments.map((e) => e.joinedAt).sort((a, b) => a.getTime() - b.getTime());
    const teachers = Array.from(new Set(st.enrollments.map((e) => e.group.teacher?.fullName).filter((x): x is string => !!x)));
    return {
      id: st.id,
      code: st.id.slice(-6).toUpperCase(),
      fullName: st.fullName,
      phone: st.phone,
      eduStatus: st.eduStatus,
      groups: st.enrollments.map((e) => ({ id: e.groupId, name: e.group.name, status: e.group.status })),
      teachers,
      joinedAt: joinDates.length ? isoDay(joinDates[0]) : "",
    };
  });

  const teacherNames = Array.from(new Set(vstudents.flatMap((st) => st.teachers))).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(s.locale, { uz: "Guruh o'quvchilari", ru: "Ученики групп", en: "Group students" })}</h1>
      </div>
      <GroupStudentsView locale={s.locale} students={vstudents} teacherNames={teacherNames} />
    </div>
  );
}
