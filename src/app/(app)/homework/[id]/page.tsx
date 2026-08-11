import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tr } from "@/lib/tr";
import { ROLES } from "@/lib/constants";
import type { Locale } from "@/lib/constants";
import { PageHeader, Card, Table, EmptyRow, Badge, Forbidden } from "../../_components/ui";
import { GradeControl, SubmitForm } from "./HwControls";

export default async function AssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireSession();

  const a = await prisma.assignment.findUnique({
    where: { id },
    include: {
      group: { include: { teacher: true, students: { include: { student: true }, orderBy: { joinedAt: "asc" } } } },
      submissions: { include: { student: true }, orderBy: { attempt: "desc" } },
    },
  });
  if (!a) notFound();

  const isOwner = s.role === ROLES.TEACHER && a.group.teacherId === s.userId;
  const isStaff = [ROLES.DIRECTOR, ROLES.ADMIN, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER].includes(s.role as never);

  // O'quvchi ko'rinishi
  if (s.role === ROLES.STUDENT) {
    const st = await prisma.student.findUnique({ where: { userId: s.userId } });
    const enrolled = a.group.students.some((gs) => gs.studentId === st?.id);
    if (!enrolled) return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu vazifa sizniki emas.", ru: "Это задание не ваше.", en: "This assignment is not yours." })} />;
    const mine = a.submissions.filter((sub) => sub.studentId === st?.id);
    return (
      <>
        <Back groupId={a.groupId} locale={s.locale} />
        <PageHeader title={a.title} subtitle={`${a.group.name} · max ${a.maxScore} ${tr(s.locale, { uz: "ball", ru: "балл", en: "points" })}`} />
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">{tr(s.locale, { uz: "Javob topshirish", ru: "Отправить ответ", en: "Submit answer" })}</h3>
            <SubmitForm assignmentId={a.id} locale={s.locale} />
          </Card>
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">{tr(s.locale, { uz: "Mening urinishlarim", ru: "Мои попытки", en: "My attempts" })}</h3>
            {mine.length === 0 ? (
              <p className="text-sm text-slate-400">{tr(s.locale, { uz: "Hali topshirmadingiz", ru: "Вы ещё не сдавали", en: "You haven't submitted yet" })}</p>
            ) : (
              <ul className="space-y-2">
                {mine.map((sub) => (
                  <li key={sub.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">#{sub.attempt}-{tr(s.locale, { uz: "urinish", ru: "попытка", en: "attempt" })}</span>
                      {sub.score != null ? <Badge tone="green">{sub.score}/{a.maxScore}</Badge> : <Badge tone="amber">{tr(s.locale, { uz: "Tekshiruvda", ru: "На проверке", en: "Under review" })}</Badge>}
                    </div>
                    <p className="mt-1 text-slate-700">{sub.content}</p>
                    {sub.teacherNote && <p className="mt-1 text-xs text-slate-500">{tr(s.locale, { uz: "Izoh", ru: "Комментарий", en: "Note" })}: {sub.teacherNote}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </>
    );
  }

  if (!isOwner && !isStaff) return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Ruxsat yo'q.", ru: "Нет доступа.", en: "No access." })} />;

  // Har o'quvchi bo'yicha oxirgi urinish
  const latestByStudent = new Map<string, (typeof a.submissions)[number]>();
  for (const sub of a.submissions) {
    if (!latestByStudent.has(sub.studentId)) latestByStudent.set(sub.studentId, sub);
  }

  return (
    <>
      <Back groupId={a.groupId} locale={s.locale} />
      <PageHeader title={a.title} subtitle={`${a.group.name} · ${a.type}${a.skill ? " · " + a.skill : ""} · max ${a.maxScore} ${tr(s.locale, { uz: "ball", ru: "балл", en: "points" })}`} />
      <Table
        head={
          <tr>
            <th className="px-4 py-3">{tr(s.locale, { uz: "O'quvchi", ru: "Ученик", en: "Student" })}</th>
            <th className="px-4 py-3">{tr(s.locale, { uz: "Javob", ru: "Ответ", en: "Answer" })}</th>
            <th className="px-4 py-3">{tr(s.locale, { uz: "Baho", ru: "Оценка", en: "Grade" })}</th>
            {isOwner && <th className="px-4 py-3">{tr(s.locale, { uz: "Baholash", ru: "Оценивание", en: "Grade" })}</th>}
          </tr>
        }
      >
        {a.group.students.length === 0 ? (
          <EmptyRow colSpan={isOwner ? 4 : 3} text={tr(s.locale, { uz: "O'quvchi yo'q", ru: "Нет учеников", en: "No students" })} />
        ) : (
          a.group.students.map((gs) => {
            const sub = latestByStudent.get(gs.studentId);
            return (
              <tr key={gs.id} className="hover:bg-slate-50 align-top">
                <td className="px-4 py-3 font-medium text-slate-800">{gs.student.fullName}</td>
                <td className="px-4 py-3 text-slate-600">{sub?.content ?? <span className="text-slate-400">{tr(s.locale, { uz: "topshirmagan", ru: "не сдано", en: "not submitted" })}</span>}</td>
                <td className="px-4 py-3">
                  {sub?.score != null ? <Badge tone="green">{sub.score}/{a.maxScore}</Badge> : sub ? <Badge tone="amber">{tr(s.locale, { uz: "Tekshiruvda", ru: "На проверке", en: "Under review" })}</Badge> : "—"}
                </td>
                {isOwner && (
                  <td className="px-4 py-3">
                    {sub ? (
                      <GradeControl submissionId={sub.id} maxScore={a.maxScore} currentScore={sub.score} currentNote={sub.teacherNote} locale={s.locale} />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })
        )}
      </Table>
    </>
  );
}

function Back({ groupId, locale }: { groupId: string; locale: Locale }) {
  return (
    <div className="mb-4 flex gap-4">
      <Link href="/homework" className="text-sm text-brand-600 hover:underline">← {tr(locale, { uz: "Vazifalar", ru: "Задания", en: "Assignments" })}</Link>
      <Link href={`/groups/${groupId}`} className="text-sm text-slate-400 hover:underline">{tr(locale, { uz: "Guruh", ru: "Группа", en: "Group" })}</Link>
    </div>
  );
}
