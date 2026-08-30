import Link from "next/link";
import { S, type StudentStrings } from "../../../_i18n";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import MissingStudent from "../../../MissingStudent";
import { getActiveLevels } from "@/lib/studyLevels";
import { levelGradient } from "@/lib/levelColor";
import HeaderBadges from "../../../HeaderBadges";

// Dars sahifasi — tepada video, ostida dars nomi va tavsifi,
// so'ng dars topshirig'i va uyga vazifa.

const safeUrl = (u: string | null | undefined) => (u && /^(\/uploads\/|https?:\/\/)/.test(u) ? u : null);
const isUpload = (u: string) => u.startsWith("/uploads/");

/** YouTube yoki Vimeo havolasini o'rnatiladigan ko'rinishga o'giradi */
function embedUrl(u: string): string | null {
  const yt = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/.exec(u);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = /vimeo\.com\/(?:video\/)?(\d+)/.exec(u);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

/** Fayl turini kengaytmadan olamiz — tugmada ko'rinadi */
const fileKind = (u: string) => {
  const ext = (u.split(".").pop() ?? "").toUpperCase();
  return ext.length <= 4 ? ext : "FAYL";
};

function IcoBack({ s = 22 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}
function IcoPlay({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="white">
      <path d="M8 5.2v13.6L19 12 8 5.2Z" />
    </svg>
  );
}
function IcoClipboard({ s = 18 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4h6v3H9z" />
      <path d="M15 5.5h2.5A1.5 1.5 0 0 1 19 7v12a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V7a1.5 1.5 0 0 1 1.5-1.5H9" />
      <path d="M8.5 12h7M8.5 16h4.5" />
    </svg>
  );
}
function IcoHome({ s = 18 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3.5 10.5 8.5-7 8.5 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5.5h4V20" />
    </svg>
  );
}
function IcoFile({ s = 18 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5Z" />
      <path d="M13.5 3.5v5h5" />
    </svg>
  );
}

/** Dars topshirig'i / uyga vazifa bloki */
function TaskCard({
  title, icon, accent, tint, body, fileUrl, t,
}: {
  title: string;
  icon: React.ReactNode;
  accent: string;
  tint: string;
  body: string | null;
  fileUrl: string | null;
  t: StudentStrings;
}) {
  return (
    <section className="overflow-hidden rounded-[22px] bg-white shadow-[0_10px_24px_rgba(19,78,94,0.10)]">
      <div className="flex items-center gap-2.5 px-4 pt-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: accent }}>
          {icon}
        </span>
        <h2 className="text-[15.5px] font-extrabold leading-tight text-slate-900">{title}</h2>
      </div>

      {body ? (
        <p className="whitespace-pre-wrap break-words px-4 pt-2.5 text-[14.5px] leading-[1.65] text-slate-600">{body}</p>
      ) : null}

      {fileUrl ? (
        <a
          href={fileUrl}
          target="_blank"
          rel="noreferrer"
          className="mx-4 mb-4 mt-3 flex items-center gap-3 rounded-2xl px-3.5 py-3 transition active:scale-[0.99]"
          style={{ background: tint }}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/85 shadow-sm" style={{ color: accent }}>
            <IcoFile />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-bold leading-tight text-slate-800">{t.openFile}</span>
            <span className="block text-[11.5px] leading-tight text-slate-500">{fileKind(fileUrl)}</span>
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </a>
      ) : (
        <div className="h-4" />
      )}
    </section>
  );
}

export default async function StudentUnitPage({ params }: { params: Promise<{ level: string; unit: string }> }) {
  const { level, unit } = await params;
  const code = level.toUpperCase();
  const lvl = (await getActiveLevels()).find((l) => l.code.toUpperCase() === code);
  if (!lvl) notFound();

  const session = await getSession();
  if (!session) redirect("/login");
  const t = S(session.locale);

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      currentLevel: true,
      enrollments: {
        where: { isActive: true },
        orderBy: { joinedAt: "desc" },
        select: { group: { select: { id: true, levelCode: true, programId: true } } },
      },
    },
  });
  if (!student) return <MissingStudent />;

  const group = student.enrollments[0]?.group ?? null;
  if (!group) notFound();

  const [lesson, allLessons, progress] = await Promise.all([
    prisma.courseLesson.findUnique({ where: { id: unit } }),
    prisma.courseLesson.findMany({
      where: { programId: group.programId },
      orderBy: { order: "asc" },
      select: { id: true, levelCode: true },
    }),
    prisma.groupLessonProgress.findMany({ where: { groupId: group.id, taught: true }, select: { courseLessonId: true } }),
  ]);

  // Boshqa kursning darsiga URL orqali kirib bo'lmasin
  if (!lesson || lesson.programId !== group.programId) notFound();

  const fallback = (group.levelCode ?? student.currentLevel ?? "A1").slice(0, 2).toUpperCase();
  const levelLessons = allLessons.filter((l) => (l.levelCode ?? fallback).toUpperCase() === code);
  const idx = levelLessons.findIndex((l) => l.id === lesson.id);
  const chapter = Math.floor(Math.max(0, idx) / 3) + 1;
  const inChapter = (Math.max(0, idx) % 3) + 1;
  const unitLabel = `Unit ${chapter}.${inChapter}`;

  const done = new Set(progress.map((p) => p.courseLessonId)).has(lesson.id);

  const video = safeUrl(lesson.videoUrl);
  const embed = video && !isUpload(video) ? embedUrl(video) : null;
  const assignmentFile = safeUrl(lesson.assignmentFileUrl);
  const homeworkFile = safeUrl(lesson.homeworkFileUrl);
  const hasAssignment = !!(lesson.assignment || assignmentFile);
  const hasHomework = !!(lesson.homework || homeworkFile);

  return (
    <div className="space-y-3.5">
      {/* ── Sarlavha ── */}
      <div className="flex items-center gap-3 pt-1">
        <Link
          href={`/student/kurse/${code}`}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-[0_6px_16px_rgba(19,78,94,0.12)]"
        >
          <IcoBack />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[18px] font-extrabold text-slate-900">{unitLabel}</div>
          <div className="truncate text-[12px] text-slate-400">{lesson.title}</div>
        </div>
        <HeaderBadges />
      </div>

      {/* ── 1. Dars videosi ── */}
      <div className="overflow-hidden rounded-[22px] bg-slate-900 shadow-[0_12px_28px_rgba(15,23,42,0.22)]">
        {video && isUpload(video) ? (
          <video src={video} controls playsInline preload="metadata" className="aspect-video w-full bg-black" />
        ) : embed ? (
          <iframe
            src={embed}
            title={lesson.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            className="aspect-video w-full border-0"
          />
        ) : video ? (
          // Tanish bo'lmagan havola — yangi oynada ochamiz
          <a
            href={video}
            target="_blank"
            rel="noreferrer"
            className="relative flex aspect-video w-full flex-col items-center justify-center gap-2.5 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900"
          >
            <span className="grid h-14 w-14 place-items-center rounded-full bg-white/20 backdrop-blur-sm">
              <IcoPlay />
            </span>
            <span className="text-[13.5px] font-bold text-white/90">{t.openVideo}</span>
          </a>
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2.5 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-white/10">
              <IcoPlay s={26} />
            </span>
            <span className="px-6 text-center text-[12.5px] font-medium leading-snug text-white/55">{t.noVideoYet}</span>
          </div>
        )}
      </div>

      {/* ── 2. Dars nomi va tavsifi ── */}
      <section className="rounded-[22px] bg-white px-5 py-4 shadow-[0_10px_24px_rgba(19,78,94,0.10)]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="rounded-lg px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-wider text-white"
            style={{ background: levelGradient(lvl.color) }}
          >
            {lvl.code} · {unitLabel}
          </span>
          {done && (
            <span className="rounded-lg bg-emerald-50 px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
              {t.watched}
            </span>
          )}
        </div>

        <h1 className="mt-2 break-words text-[22px] font-extrabold leading-tight text-slate-900">{lesson.title}</h1>

        {lesson.topic ? (
          <p className="mt-1.5 whitespace-pre-wrap break-words text-[14.5px] leading-[1.65] text-slate-500">{lesson.topic}</p>
        ) : null}
      </section>

      {/* ── 3. Dars topshirig'i ── */}
      {hasAssignment && (
        <TaskCard
          title={t.lessonAssignment}
          icon={<IcoClipboard />}
          accent="#0e7490"
          tint="#ecfaff"
          body={lesson.assignment}
          fileUrl={assignmentFile}
          t={t}
        />
      )}

      {/* ── 4. Uyga vazifa ── */}
      {hasHomework && (
        <TaskCard
          title={t.homeworkTask}
          icon={<IcoHome />}
          accent="#7c3aed"
          tint="#f4efff"
          body={lesson.homework}
          fileUrl={homeworkFile}
          t={t}
        />
      )}

      {!video && !hasAssignment && !hasHomework && (
        <div className="rounded-[22px] bg-white/85 px-5 py-10 text-center shadow-[0_10px_22px_rgba(19,78,94,0.10)]">
          <div className="text-[14px] font-semibold text-slate-700">{t.noMaterial}</div>
        </div>
      )}
    </div>
  );
}
