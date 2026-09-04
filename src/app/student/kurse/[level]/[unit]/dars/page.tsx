import Link from "next/link";
import { prisma } from "@/lib/db";
import MissingStudent from "../../../../MissingStudent";
import { loadUnit } from "../_load";
import { SectionHeader, TaskCard, IcoClipboard, embedUrl, isUpload, safeUrl, youtubePoster } from "../_parts";
import LessonVideo, { type VideoMode } from "../LessonVideo";

// Darsning o'zi: video, nomi, tavsifi va dars topshirig'i.
// Uy vazifasi bu yerda EMAS — u alohida bo'limda (../vazifa).

const ACCENT = "linear-gradient(150deg, #2fb9dc 0%, #0e7490 100%)";
const TEALG = "linear-gradient(150deg, #46d8b8 0%, #0f9a90 100%)";

export default async function LessonMainPage({
  params,
}: {
  params: Promise<{ level: string; unit: string }>;
}) {
  const { level, unit } = await params;
  const ctx = await loadUnit(level, unit);
  if (ctx.missing) return <MissingStudent />;

  const { t, code, lesson, unitLabel, unitNo, position, totalInLevel, prev, next } = ctx;

  const view = await prisma.lessonView.findFirst({
    where: { studentId: ctx.studentId, courseLessonId: lesson.id },
    select: { id: true },
  });

  const video = safeUrl(lesson.videoUrl);
  const embed = video && !isUpload(video) ? embedUrl(video) : null;
  const mode: VideoMode = !video ? "none" : isUpload(video) ? "file" : embed ? "embed" : "link";
  const poster = video && !isUpload(video) ? youtubePoster(video) : null;

  const assignmentFile = safeUrl(lesson.assignmentFileUrl);
  const hasAssignment = !!(lesson.assignment || assignmentFile);

  // Mavzu maydoni lug'at bo'lsa u "Lug'at" bo'limida chiqadi — bu yerda
  // tavsif sifatida takrorlanmaydi.
  const topicIsDescription = !!lesson.topic && !/[-–—]/.test(lesson.topic) && lesson.topic.split(/[,;\n]/).length < 3;

  const navBtn =
    "gl-glass flex h-[54px] flex-1 items-center gap-2.5 rounded-[20px] px-3.5 text-slate-700 transition active:scale-[0.98]";

  return (
    <div>
      <SectionHeader
        backHref={`/student/kurse/${code}/${lesson.id}`}
        backLabel={t.back}
        title={t.lesson}
        subtitle={`${unitLabel} · ${lesson.title}`}
        accent={ACCENT}
      />

      <div className="mt-4 space-y-3.5">
        <LessonVideo
          mode={mode}
          src={mode === "embed" ? embed : video}
          poster={poster}
          title={unitLabel}
          kicker={`${t.lesson} ${position + 1}/${Math.max(totalInLevel, 1)}`}
          badge={unitNo}
          pill={lesson.title}
          openLabel={t.openVideo}
          emptyLabel={t.noVideoYet}
          lessonId={lesson.id}
          watched={!!view}
          markLabel={t.markWatched}
          doneLabel={t.watchedDone}
        />

        {topicIsDescription && (
          <section className="gl-glass rounded-[26px] p-4">
            <h2 className="break-words text-[20px] font-extrabold leading-[1.2] tracking-[-0.02em] text-slate-900">
              {lesson.title}
            </h2>
            <p className="mt-1.5 whitespace-pre-wrap break-words text-[14.5px] leading-[1.6] text-slate-600">
              {lesson.topic}
            </p>
          </section>
        )}

        {hasAssignment && (
          <TaskCard
            title={t.lessonAssignment}
            icon={<IcoClipboard />}
            accent={TEALG}
            tint="#eafaf5"
            wash="rgba(52,211,153,0.22)"
            body={lesson.assignment}
            fileUrl={assignmentFile}
            t={t}
          />
        )}

        {!video && !hasAssignment && (
          <div className="gl-glass rounded-[26px] px-5 py-12 text-center">
            <div className="text-[14.5px] font-semibold text-slate-700">{t.noMaterial}</div>
          </div>
        )}

        {/* Oldingi / keyingi dars */}
        {(prev || next) && (
          <nav className="flex gap-2.5 pt-0.5">
            {prev ? (
              <Link href={`/student/kurse/${code}/${prev.id}/dars`} className={navBtn}>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">{t.prevLesson}</span>
                  <span className="block truncate text-[12.5px] font-semibold leading-tight">{prev.title}</span>
                </span>
              </Link>
            ) : null}
            {next ? (
              <Link href={`/student/kurse/${code}/${next.id}/dars`} className={navBtn}>
                <span className="min-w-0 flex-1 text-right">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">{t.nextLesson}</span>
                  <span className="block truncate text-[12.5px] font-semibold leading-tight">{next.title}</span>
                </span>
              </Link>
            ) : null}
          </nav>
        )}
      </div>
    </div>
  );
}
