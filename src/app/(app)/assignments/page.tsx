import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, getPermission, MODULES } from "@/lib/rbac";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import AssignmentsView, { type VAssignment } from "./AssignmentsView";
import type { Prisma } from "@prisma/client";

const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDateTime = (d: Date | null) => (d ? `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}` : "");
const fmtDate = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;

export default async function AssignmentsPage() {
  const s = await requireSession();

  if (!canRead(s.role, MODULES.GROUPS)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsat yo'q.", ru: "Нет доступа к этому разделу.", en: "You do not have access to this section." })} />;
  }

  // Ko'lam: o'qituvchi faqat o'z guruhlari vazifalarini ko'radi
  let where: Prisma.AssignmentWhereInput = {};
  if (s.role === ROLES.TEACHER) where = { group: { teacherId: s.userId } };

  const assignments = await prisma.assignment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      group: { select: { id: true, name: true, teacher: { select: { fullName: true } } } },
      _count: { select: { submissions: true } },
    },
  });

  const vitems: VAssignment[] = assignments.map((a) => ({
    id: a.id,
    type: a.type,
    title: a.title,
    dueAt: fmtDateTime(a.dueAt),
    teacherName: a.group.teacher?.fullName ?? null,
    groupId: a.group.id,
    groupName: a.group.name,
    maxScore: a.maxScore,
    note: a.note,
    createdAt: fmtDate(a.createdAt),
    submissions: a._count.submissions,
  }));

  const canCreate = getPermission(s.role, MODULES.GROUPS) === "FULL" || s.role === ROLES.TEACHER;
  const groups = canCreate
    ? await prisma.group.findMany({
        where: s.role === ROLES.TEACHER ? { teacherId: s.userId } : {},
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const teacherNames = Array.from(new Set(vitems.map((a) => a.teacherName).filter(Boolean))) as string[];
  const groupNames = Array.from(new Set(vitems.map((a) => a.groupName)));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(s.locale, { uz: "Barcha vazifalar", ru: "Все задания", en: "All assignments" })}</h1>
      </div>
      <AssignmentsView
        locale={s.locale}
        assignments={vitems}
        canCreate={canCreate}
        groups={groups}
        teacherNames={teacherNames.sort()}
        groupNames={groupNames.sort()}
      />
    </div>
  );
}
