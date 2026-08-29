import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { branchWhere } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import TasksView, { type VTask } from "./TasksView";

export default async function TasksPage() {
  const s = await requireSession();
  if (s.role === ROLES.STUDENT || s.role === ROLES.PARENT) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim xodimlar uchun.", ru: "Этот раздел для сотрудников.", en: "This section is for staff.", de: "Dieser Bereich ist für Mitarbeiter." })} />;
  }

  const [tasks, staff, students, groups] = await Promise.all([
    prisma.task.findMany({
      where: { AND: [{ kind: "TASK" }, branchWhere(s)] }, // faol filial topshiriqlari
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
      include: { assignee: true, student: true, group: true, author: true },
      take: 300,
    }),
    // faol filial doirasida
    prisma.user.findMany({ where: { AND: [{ role: { notIn: [ROLES.STUDENT, ROLES.PARENT] }, isActive: true }, branchWhere(s)] }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    prisma.student.findMany({ where: branchWhere(s), select: { id: true, fullName: true }, orderBy: { fullName: "asc" }, take: 500 }), // faol filial doirasida
    prisma.group.findMany({ where: branchWhere(s), select: { id: true, name: true }, orderBy: { name: "asc" } }), // faol filial doirasida
  ]);

  const vtasks: VTask[] = tasks.map((t) => ({
    id: t.id, title: t.title, note: t.note, tag: t.tag, status: t.status, priority: t.priority,
    dueAt: t.dueAt ? t.dueAt.toISOString() : null,
    assignee: t.assignee?.fullName ?? null, student: t.student?.fullName ?? null, group: t.group?.name ?? null,
    author: t.author?.fullName ?? null, createdAt: t.createdAt.toISOString(),
  }));

  return (
    <TasksView
      kind="TASK"
      title={tr(s.locale, { uz: "Topshiriqlar", ru: "Задачи", en: "Tasks", de: "Aufgaben" })}
      locale={s.locale}
      tasks={vtasks}
      staff={staff.map((x) => ({ id: x.id, name: x.fullName }))}
      students={students.map((x) => ({ id: x.id, name: x.fullName }))}
      groups={groups.map((x) => ({ id: x.id, name: x.name }))}
    />
  );
}
