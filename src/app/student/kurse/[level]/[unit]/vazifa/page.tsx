import { prisma } from "@/lib/db";
import MissingStudent from "../../../../MissingStudent";
import { loadUnit } from "../_load";
import { SectionHeader, TaskCard, IcoHome, safeUrl } from "../_parts";
import LessonTasks, { type VTask } from "../LessonTasks";

// Uy vazifasi: o'qituvchi yozgan vazifa matni/fayli va topshirish bloki
// (topshirilgan ish, bahosi va o'qituvchi izohi).

const ACCENT = "linear-gradient(150deg, #b07bff 0%, #7c3aed 100%)";

export default async function LessonHomeworkPage({
  params,
}: {
  params: Promise<{ level: string; unit: string }>;
}) {
  const { level, unit } = await params;
  const ctx = await loadUnit(level, unit);
  if (ctx.missing) return <MissingStudent />;

  const { t, code, lesson, unitLabel } = ctx;

  // Faqat o'quvchining O'Z guruhiga berilgan vazifalar
  const tasks = await prisma.assignment.findMany({
    where: { courseLessonId: lesson.id, groupId: ctx.groupId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, title: true, type: true, maxScore: true, dueAt: true, note: true, createdAt: true,
      submissions: {
        where: { studentId: ctx.studentId },
        orderBy: { attempt: "desc" },
        select: {
          id: true, attempt: true, content: true, fileUrl: true, score: true,
          status: true, teacherNote: true, gradedAt: true, createdAt: true,
          gradedBy: { select: { fullName: true } },
        },
      },
      _count: { select: { submissions: { where: { status: "GRADED" } } } },
    },
  });

  const vTasks: VTask[] = tasks.map((a) => ({
    id: a.id,
    title: a.title,
    type: a.type,
    maxScore: a.maxScore,
    dueAt: a.dueAt ? a.dueAt.toISOString() : null,
    note: a.note,
    createdAt: a.createdAt.toISOString(),
    passed: a._count.submissions,
    subs: a.submissions.map((x) => ({
      id: x.id,
      attempt: x.attempt,
      content: x.content,
      fileUrl: x.fileUrl,
      score: x.score,
      status: x.status,
      teacherNote: x.teacherNote,
      gradedBy: x.gradedBy?.fullName ?? null,
      gradedAt: x.gradedAt ? x.gradedAt.toISOString() : null,
      createdAt: x.createdAt.toISOString(),
    })),
  }));

  const homeworkFile = safeUrl(lesson.homeworkFileUrl);
  const hasHomework = !!(lesson.homework || homeworkFile);

  return (
    <div>
      <SectionHeader
        backHref={`/student/kurse/${code}/${lesson.id}`}
        backLabel={t.back}
        title={t.homeworkTask}
        subtitle={`${unitLabel} · ${lesson.title}`}
        accent={ACCENT}
      />

      <div className="mt-4 space-y-3.5">
        {hasHomework && (
          <TaskCard
            title={t.homeworkTask}
            icon={<IcoHome />}
            accent={ACCENT}
            tint="#f4eeff"
            wash="rgba(167,139,250,0.24)"
            body={lesson.homework}
            fileUrl={homeworkFile}
            t={t}
          />
        )}

        <LessonTasks tasks={vTasks} />

        {!hasHomework && vTasks.length === 0 && (
          <div className="gl-glass rounded-[26px] px-5 py-14 text-center">
            <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-white/60 text-slate-400">
              <IcoHome s={26} />
            </span>
            <div className="text-[14.5px] font-semibold text-slate-700">{t.noTasksInLesson}</div>
          </div>
        )}
      </div>
    </div>
  );
}
