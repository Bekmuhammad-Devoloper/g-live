import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { tr } from "@/lib/tr";
import { canRead, MODULES } from "@/lib/rbac";
import { branchWhere, branchViaGroup } from "@/lib/branchScope";
import { ROLES } from "@/lib/constants";
import { PageHeader, Table, EmptyRow, Badge, Forbidden } from "../_components/ui";
import NewAssignmentForm from "./NewAssignmentForm";
import type { Prisma } from "@prisma/client";

export default async function HomeworkPage() {
  const s = await requireSession();
  const t = getT(s.locale);

  if (!canRead(s.role, MODULES.HOMEWORK)) {
    return <Forbidden title={t("err.forbidden")} body={t("err.forbiddenBody")} />;
  }

  let where: Prisma.AssignmentWhereInput = {};
  if (s.role === ROLES.TEACHER) {
    where = { group: { teacherId: s.userId } };
  } else if (s.role === ROLES.STUDENT) {
    const st = await prisma.student.findUnique({ where: { userId: s.userId } });
    where = { group: { students: { some: { studentId: st?.id ?? "__none__" } } } };
  }
  // O'quvchi/ota-ona o'z vazifalarini filialdan qat'i nazar ko'radi, xodimlar — faol filial doirasida
  const selfScoped = s.role === ROLES.STUDENT || s.role === ROLES.PARENT;
  if (!selfScoped) where = { AND: [where, branchViaGroup(s)] };

  const assignments = await prisma.assignment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { group: true, _count: { select: { submissions: true } } },
  });

  const isTeacher = s.role === ROLES.TEACHER;
  const ownGroups = isTeacher
    // faol filial doirasida
    ? await prisma.group.findMany({ where: { AND: [{ teacherId: s.userId }, branchWhere(s)] }, select: { id: true, name: true } })
    : [];

  return (
    <>
      <PageHeader
        title={t("nav.homework")}
        subtitle={tr(s.locale, { uz: "Vazifalar va baholash (TZ 4.4)", ru: "Задания и оценивание (ТЗ 4.4)", en: "Assignments and grading (TZ 4.4)" })}
        action={isTeacher ? <NewAssignmentForm groups={ownGroups} locale={s.locale} /> : undefined}
      />
      <Table
        head={
          <tr>
            <th className="px-4 py-3">{tr(s.locale, { uz: "Vazifa", ru: "Задание", en: "Assignment" })}</th>
            <th className="px-4 py-3">{tr(s.locale, { uz: "Guruh", ru: "Группа", en: "Group" })}</th>
            <th className="px-4 py-3">{tr(s.locale, { uz: "Turi", ru: "Тип", en: "Type" })}</th>
            <th className="px-4 py-3">{tr(s.locale, { uz: "Ko'nikma", ru: "Навык", en: "Skill" })}</th>
            <th className="px-4 py-3">{tr(s.locale, { uz: "Topshirganlar", ru: "Сдавшие", en: "Submitted" })}</th>
            <th className="px-4 py-3">{tr(s.locale, { uz: "Muddat", ru: "Срок", en: "Due date" })}</th>
          </tr>
        }
      >
        {assignments.length === 0 ? (
          <EmptyRow colSpan={6} text={t("common.noData")} />
        ) : (
          assignments.map((a) => (
            <tr key={a.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium">
                <Link href={`/homework/${a.id}`} className="text-brand-700 hover:underline">{a.title}</Link>
              </td>
              <td className="px-4 py-3 text-slate-600">{a.group.name}</td>
              <td className="px-4 py-3"><Badge tone="blue">{a.type}</Badge></td>
              <td className="px-4 py-3 text-slate-500">{a.skill ?? "—"}</td>
              <td className="px-4 py-3"><Badge tone="brand">{a._count.submissions}</Badge></td>
              <td className="px-4 py-3 text-slate-500">
                {a.dueAt ? new Intl.DateTimeFormat(s.locale === "ru" ? "ru-RU" : "uz-UZ").format(a.dueAt) : "—"}
              </td>
            </tr>
          ))
        )}
      </Table>
      <p className="mt-3 text-xs text-slate-400">
        ℹ️ {tr(s.locale, { uz: "Topshirish/tekshirish interfeysi va ko'nikma bo'yicha rivojlanish grafiklari keyingi iteratsiyada.", ru: "Интерфейс сдачи/проверки и графики развития по навыкам — в следующей итерации.", en: "Submission/review interface and skill progress charts are coming in the next iteration." })}
      </p>
    </>
  );
}
