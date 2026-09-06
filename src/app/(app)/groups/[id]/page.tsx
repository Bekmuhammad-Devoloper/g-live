import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPermission, MODULES } from "@/lib/rbac";
import { ROLES } from "@/lib/constants";
import { branchWhere } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { PageHeader, Card, Table, EmptyRow, Badge, Forbidden } from "../../_components/ui";
import { Icon } from "../../_components/Icon";
import { CreateStudentForm, EnrollExisting, BulkImportStudents, NewLessonForm, RemoveStudentButton, EditGroupButton } from "./GroupForms";
import { GroupAttendance } from "./GroupAttendance";
import CourseLessonsTab from "../../courses/[id]/CourseLessonsTab";
import { getLevelCodes } from "@/lib/studyLevels";
import { groupColor } from "../groupColor";
import { isPaymentMandatoryBulk } from "@/lib/paymentPolicy";

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireSession();

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      teacher: true,
      program: true,
      students: { include: { student: true }, orderBy: { joinedAt: "asc" } },
      lessons: { orderBy: { startsAt: "desc" } },
    },
  });
  if (!group) notFound();

  const full = getPermission(s.role, MODULES.GROUPS) === "FULL";
  const isOwnerTeacher = s.role === ROLES.TEACHER && group.teacherId === s.userId;

  // Ko'lam cheklovi (URL orqali begona guruhga kirishni bloklash)
  let allowed = full || s.role === ROLES.DIRECTOR || s.role === ROLES.ADMIN || isOwnerTeacher;
  if (!allowed && s.role === ROLES.STUDENT) {
    const st = await prisma.student.findUnique({ where: { userId: s.userId } });
    allowed = group.students.some((gs) => gs.studentId === st?.id);
  }
  if (!allowed && s.role === ROLES.PARENT) {
    const parent = await prisma.parent.findUnique({ where: { userId: s.userId }, include: { children: true } });
    const childIds = new Set(parent?.children.map((c) => c.studentId));
    allowed = group.students.some((gs) => childIds.has(gs.studentId));
  }
  if (!allowed) return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu guruhga kirish huquqingiz yo'q.", ru: "У вас нет прав доступа к этой группе.", en: "You do not have access to this group.", de: "Sie haben keinen Zugriff auf diese Gruppe." })} />;

  const canManage = full || isOwnerTeacher;

  // Kurs dars rejasi (video/mavzu/topshiriq/uy vazifasi) + shu guruh o'tgan darslari
  const [courseLessons, progressRows] = await Promise.all([
    prisma.courseLesson.findMany({ where: { programId: group.programId }, orderBy: { order: "asc" } }),
    prisma.groupLessonProgress.findMany({ where: { groupId: group.id }, select: { courseLessonId: true, taught: true } }),
  ]);
  const lessonProgress: Record<string, boolean> = {};
  for (const pr of progressRows) lessonProgress[pr.courseLessonId] = pr.taught;
  const levelCodes = await getLevelCodes();
  const vLessons = courseLessons.map((cl) => ({ id: cl.id, order: cl.order, levelCode: cl.levelCode, title: cl.title, topic: cl.topic, videoUrl: cl.videoUrl, vocabText: cl.vocabText, vocabFileUrl: cl.vocabFileUrl, materialUrl: cl.materialUrl, assignment: cl.assignment, assignmentFileUrl: cl.assignmentFileUrl, homework: cl.homework, homeworkFileUrl: cl.homeworkFileUrl }));

  // To'lov majburiy holati (3 dan ko'p dars o'tilgan, to'lanmagan) — davomat blokini ko'rsatish uchun
  const enrolledIds = group.students.map((gs) => gs.studentId);
  const mandatoryMap = canManage ? await isPaymentMandatoryBulk(enrolledIds) : new Map();
  const attendanceStudents = group.students.map((gs) => {
    const b = mandatoryMap.get(gs.studentId);
    return { id: gs.studentId, name: gs.student.fullName, blocked: b?.mandatory ?? false, lessonsThisMonth: b?.lessonsThisMonth ?? 0 };
  });

  // Biriktirish uchun nomzodlar (bu guruhda bo'lmagan o'quvchilar)
  const candidates = full
    ? await prisma.student.findMany({
        // faol filial o'quvchilarigina biriktirish uchun taklif qilinadi
        where: { AND: [{ id: { notIn: enrolledIds.length ? enrolledIds : ["__none__"] } }, branchWhere(s)] },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
        take: 100,
      })
    : [];

  // Tahrirlash formasi uchun kurs/o'qituvchi ro'yxatlari (faqat FULL huquqli rollarga)
  const [programs, teachers] = full
    ? await Promise.all([
        prisma.program.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
        // faol filial o'qituvchilari
        prisma.user.findMany({ where: { AND: [{ role: ROLES.TEACHER }, branchWhere(s)] }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
      ])
    : [[], []];

  const editData = {
    id: group.id,
    name: group.name,
    programId: group.programId,
    teacherId: group.teacherId,
    levelCode: group.levelCode,
    color: group.color,
    format: group.format,
    onlineLink: group.onlineLink,
    room: group.room,
    status: group.status,
    capacity: group.capacity,
    startDate: group.startDate ? group.startDate.toISOString().slice(0, 10) : null,
    endDate: group.endDate ? group.endDate.toISOString().slice(0, 10) : null,
    weekdays: group.weekdays,
    startTime: group.startTime,
    endTime: group.endTime,
    note: group.note,
    monthlyFee: group.monthlyFee,
  };

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat(s.locale === "ru" ? "ru-RU" : "uz-UZ", { dateStyle: "short", timeStyle: "short" }).format(d);

  return (
    <>
      <div className="mb-4">
        <Link href="/groups" className="text-sm text-brand-600 hover:underline">← {tr(s.locale, { uz: "Guruhlar", ru: "Группы", en: "Groups", de: "Gruppen" })}</Link>
      </div>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2.5">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: groupColor(group.id, group.color) }} />
            {group.name}
          </span>
        }
        subtitle={`${group.program.name} · ${group.levelCode ?? "—"} · ${group.room ?? "—"} · ${tr(s.locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher", de: "Lehrer" })}: ${group.teacher?.fullName ?? "—"}`}
        action={full ? <EditGroupButton group={editData} programs={programs} teachers={teachers} locale={s.locale} /> : undefined}
      />

      {/* Guruh izohi (kament) */}
      {group.note && (
        <div className="mb-6 flex gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-500/10">
          <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              {tr(s.locale, { uz: "Izoh", ru: "Комментарий", en: "Comment", de: "Kommentar" })}
            </div>
            <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">{group.note}</p>
          </div>
        </div>
      )}

      {canManage && (
        <Card className="mb-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {tr(s.locale, { uz: "Davomat", ru: "Посещаемость", en: "Attendance", de: "Anwesenheit" })}
            <span className="text-xs font-normal text-slate-400">({tr(s.locale, { uz: "bor / yo'q", ru: "есть / нет", en: "present / absent", de: "anwesend / abwesend" })})</span>
          </h3>
          <GroupAttendance groupId={group.id} students={attendanceStudents} locale={s.locale} />
        </Card>
      )}

      <Card className="mb-6">
        <h3 className="mb-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          {tr(s.locale, { uz: "Dars rejasi", ru: "План уроков", en: "Lesson plan", de: "Unterrichtsplan" })}
          <span className="text-xs font-normal text-slate-400">({tr(s.locale, { uz: "video · mavzu · topshiriq · uy vazifasi", ru: "видео · тема · задание · домашка", en: "video · topic · assignment · homework", de: "Video · Thema · Aufgabe · Hausaufgabe" })})</span>
        </h3>
        <CourseLessonsTab programId={group.programId} lessons={vLessons} canManage={canManage} locale={s.locale} levelCodes={levelCodes} groupId={group.id} progress={lessonProgress} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* O'quvchilar */}
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">{tr(s.locale, { uz: "O'quvchilar", ru: "Ученики", en: "Students", de: "Schüler" })} ({group.students.length}/{group.capacity})</h3>
          {full && (
            <div className="mb-4 space-y-3 rounded-lg bg-slate-50 p-3 dark:bg-white/[0.03]">
              <CreateStudentForm groupId={group.id} locale={s.locale} />
              <EnrollExisting groupId={group.id} candidates={candidates} locale={s.locale} />
              <BulkImportStudents groupId={group.id} locale={s.locale} />
            </div>
          )}
          {group.students.length === 0 ? (
            <p className="text-sm text-slate-400">{tr(s.locale, { uz: "O'quvchi yo'q", ru: "Нет учеников", en: "No students", de: "Keine Schüler" })}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {group.students.map((gs) => (
                <li key={gs.id} className="flex items-center justify-between py-2 text-sm">
                  <Link
                    href={`/students/${gs.studentId}`}
                    className="truncate text-slate-700 transition hover:text-brand-600 hover:underline dark:hover:text-brand-300"
                  >
                    {gs.student.fullName}
                  </Link>
                  <div className="flex items-center gap-2">
                    <Badge tone="slate">{gs.student.currentLevel ?? "—"}</Badge>
                    {full && <RemoveStudentButton groupId={group.id} studentId={gs.studentId} locale={s.locale} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Darslar */}
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">{tr(s.locale, { uz: "Darslar", ru: "Уроки", en: "Lessons", de: "Unterricht" })} ({group.lessons.length})</h3>
          {canManage && (
            <div className="mb-4 rounded-lg bg-slate-50 p-3">
              <NewLessonForm groupId={group.id} locale={s.locale} />
            </div>
          )}
          {group.lessons.length === 0 ? (
            <p className="text-sm text-slate-400">{tr(s.locale, { uz: "Dars yo'q", ru: "Нет уроков", en: "No lessons", de: "Kein Unterricht" })}</p>
          ) : (
            <Table
              head={
                <tr>
                  <th className="px-3 py-2">{tr(s.locale, { uz: "Vaqt", ru: "Время", en: "Time", de: "Zeit" })}</th>
                  <th className="px-3 py-2">{tr(s.locale, { uz: "Mavzu", ru: "Тема", en: "Topic", de: "Thema" })}</th>
                  <th className="px-3 py-2">QR</th>
                </tr>
              }
            >
              {group.lessons.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Link href={`/groups/${group.id}/lessons/${l.id}`} className="text-brand-700 hover:underline">{fmt(l.startsAt)}</Link>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{l.topic ?? "—"}</td>
                  <td className="px-3 py-2">
                    {l.qrToken && l.qrExpiresAt && l.qrExpiresAt.getTime() > Date.now()
                      ? <Badge tone="green">{tr(s.locale, { uz: "Faol", ru: "Активен", en: "Active", de: "Aktiv" })}</Badge>
                      : <Badge tone="slate">—</Badge>}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
