import MissingStudent from "../../../../../MissingStudent";
import { loadUnit } from "../../_load";
import { SectionHeader, TaskCard, IcoClipboard, safeUrl } from "../../_parts";

// "Video mashq" — darsning topshirig'i (uy vazifasi emas, u alohida bo'limda).

const ACCENT = "linear-gradient(150deg, #46d8b8 0%, #0f9a90 100%)";

export default async function VideoExercisePage({
  params,
}: {
  params: Promise<{ level: string; unit: string }>;
}) {
  const { level, unit } = await params;
  const ctx = await loadUnit(level, unit);
  if (ctx.missing) return <MissingStudent />;

  const { t, code, lesson, unitLabel } = ctx;
  const file = safeUrl(lesson.assignmentFileUrl);
  const has = !!(lesson.assignment || file);

  return (
    <div>
      <SectionHeader
        backHref={`/student/kurse/${code}/${lesson.id}/dars/video`}
        backLabel={t.back}
        title={t.videoExercise}
        subtitle={`${unitLabel} · ${lesson.title}`}
        accent={ACCENT}
      />

      <div className="mt-4">
        {has ? (
          <TaskCard
            title={t.lessonAssignment}
            icon={<IcoClipboard />}
            accent={ACCENT}
            tint="#eafaf5"
            wash="rgba(52,211,153,0.22)"
            body={lesson.assignment}
            fileUrl={file}
            t={t}
          />
        ) : (
          <div className="gl-glass rounded-[26px] px-5 py-14 text-center">
            <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-white/60 text-slate-400">
              <IcoClipboard s={26} />
            </span>
            <div className="text-[14.5px] font-semibold text-slate-700">{t.noExercise}</div>
          </div>
        )}
      </div>
    </div>
  );
}
