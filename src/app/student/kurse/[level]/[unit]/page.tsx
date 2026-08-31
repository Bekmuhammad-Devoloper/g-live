import Link from "next/link";
import { S, type StudentStrings } from "../../../_i18n";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import MissingStudent from "../../../MissingStudent";
import { getActiveLevels } from "@/lib/studyLevels";
import HeaderBadges from "../../../HeaderBadges";
import LessonVideo, { type VideoMode } from "./LessonVideo";

// Dars sahifasi — tepada video, ostida dars nomi va tavsifi, so'ng dars
// topshirig'i va uyga vazifa, pastida oldingi/keyingi darsga o'tish.

const safeUrl = (u: string | null | undefined) => (u && /^(\/uploads\/|https?:\/\/)/.test(u) ? u : null);
const isUpload = (u: string) => u.startsWith("/uploads/");
const ext = (u: string) => (u.split("?")[0].split(".").pop() ?? "").toLowerCase();
const isImage = (u: string) => ["png", "jpg", "jpeg", "webp", "gif", "avif"].includes(ext(u));
const fileKind = (u: string) => {
  const e = ext(u).toUpperCase();
  return e && e.length <= 4 ? e : "FAYL";
};

/** YouTube yoki Vimeo havolasini o'rnatiladigan ko'rinishga o'giradi */
function embedUrl(u: string): string | null {
  const yt = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/.exec(u);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = /vimeo\.com\/(?:video\/)?(\d+)/.exec(u);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

/* ── Ikonkalar ── */
function IcoBack({ s = 21 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 5.5-6.5 6.5 6.5 6.5" />
    </svg>
  );
}
function IcoBook({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6.5C10.5 5 8.4 4.4 4.5 4.5v13c3.9-.1 6 .5 7.5 2 1.5-1.5 3.6-2.1 7.5-2v-13c-3.9-.1-6 .5-7.5 2Z" />
      <path d="M12 6.5v13" />
    </svg>
  );
}
function IcoClipboard({ s = 24 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8.5" y="2.8" width="7" height="3.6" rx="1.2" />
      <path d="M15.5 4.6h2A1.5 1.5 0 0 1 19 6.1v13.4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5V6.1a1.5 1.5 0 0 1 1.5-1.5h2" />
      <path d="M8.5 12h7M8.5 16h4.5" />
    </svg>
  );
}
function IcoHome({ s = 24 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3.4 10.6 8.6-7.1 8.6 7.1" />
      <path d="M5.6 9.6V20h12.8V9.6" />
      <path d="M9.8 20v-5.6h4.4V20" />
    </svg>
  );
}
function IcoFile({ s = 18 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5Z" />
      <path d="M13.5 3.5v5h5" />
    </svg>
  );
}
function IcoChevron({ s = 18, color = "#94a3b8" }: { s?: number; color?: string }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
function IcoCheck({ s = 13 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}
function IcoExpand({ s = 14 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4h6v6M20 4l-7.5 7.5M10 20H4v-6M4 20l7.5-7.5" />
    </svg>
  );
}

/* ── Kartaning burchagidagi yumshoq rang dog'i ── */
function Wash({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -right-10 -top-14 h-52 w-52 rounded-full blur-2xl"
      style={{ background: color }}
    />
  );
}

/* ── Biriktirilgan fayl ── */
function Attachment({ url, tint, accent, t }: { url: string; tint: string; accent: string; t: StudentStrings }) {
  const row = (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-[18px] px-3 py-2.5 transition active:scale-[0.985]"
      style={{ background: tint }}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-white shadow-[0_4px_10px_-4px_rgba(15,60,80,0.4)]" style={{ color: accent }}>
        <IcoFile />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-bold leading-tight text-slate-800">{t.openFile}</span>
        <span className="block text-[11.5px] font-medium leading-tight text-slate-400">{fileKind(url)}</span>
      </span>
      <IcoChevron />
    </a>
  );

  if (!isImage(url)) return <div className="mt-3">{row}</div>;

  // Rasm bo'lsa avval o'zi ko'rinadi — ochib o'tirish shart emas
  return (
    <div className="mt-3 space-y-2">
      <a href={url} target="_blank" rel="noreferrer" className="relative block overflow-hidden rounded-[18px]" style={{ background: tint }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={t.attachment} className="max-h-[360px] w-full object-contain" />
        <span className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
          <IcoExpand /> {t.openFull}
        </span>
      </a>
      {row}
    </div>
  );
}

/* ── Dars topshirig'i / uyga vazifa bloki ── */
function TaskCard({
  title, icon, accent, tint, wash, body, fileUrl, t,
}: {
  title: string;
  icon: React.ReactNode;
  accent: string;
  tint: string;
  wash: string;
  body: string | null;
  fileUrl: string | null;
  t: StudentStrings;
}) {
  return (
    <section className="relative overflow-hidden rounded-[26px] bg-white p-4 shadow-[0_16px_38px_-22px_rgba(15,60,80,0.55)] ring-1 ring-slate-900/[0.04]">
      <Wash color={wash} />
      <div className="relative flex gap-3.5">
        <span
          className="grid h-[56px] w-[56px] shrink-0 place-items-center rounded-[19px] text-white shadow-[0_10px_20px_-8px_rgba(15,60,80,0.65)]"
          style={{ background: accent }}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1 pt-1">
          <h2 className="text-[17px] font-extrabold leading-tight tracking-[-0.015em] text-slate-900">{title}</h2>
          {body ? (
            <p className="mt-1 whitespace-pre-wrap break-words text-[14.5px] leading-[1.6] text-slate-400">{body}</p>
          ) : null}
        </div>
      </div>

      {fileUrl ? (
        <div className="relative">
          <Attachment url={fileUrl} tint={tint} accent={accent} t={t} />
        </div>
      ) : null}
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

  const [lesson, allLessons, progress, view] = await Promise.all([
    prisma.courseLesson.findUnique({ where: { id: unit } }),
    prisma.courseLesson.findMany({
      where: { programId: group.programId },
      orderBy: { order: "asc" },
      select: { id: true, levelCode: true, title: true },
    }),
    prisma.groupLessonProgress.findMany({ where: { groupId: group.id, taught: true }, select: { courseLessonId: true } }),
    prisma.lessonView.findFirst({
      where: { studentId: student.id, courseLessonId: unit },
      select: { id: true },
    }),
  ]);

  // Boshqa kursning darsiga URL orqali kirib bo'lmasin
  if (!lesson || lesson.programId !== group.programId) notFound();

  const fallback = (group.levelCode ?? student.currentLevel ?? "A1").slice(0, 2).toUpperCase();
  const levelLessons = allLessons.filter((l) => (l.levelCode ?? fallback).toUpperCase() === code);
  const idx = levelLessons.findIndex((l) => l.id === lesson.id);
  const pos = Math.max(0, idx);
  const chapter = Math.floor(pos / 3) + 1;
  const inChapter = (pos % 3) + 1;
  const unitNo = `${chapter}.${inChapter}`;
  const unitLabel = `Unit ${unitNo}`;
  const prev = idx > 0 ? levelLessons[idx - 1] : null;
  const next = idx >= 0 && idx < levelLessons.length - 1 ? levelLessons[idx + 1] : null;

  const done = new Set(progress.map((p) => p.courseLessonId)).has(lesson.id);

  const video = safeUrl(lesson.videoUrl);
  const embed = video && !isUpload(video) ? embedUrl(video) : null;
  const mode: VideoMode = !video ? "none" : isUpload(video) ? "file" : embed ? "embed" : "link";

  const assignmentFile = safeUrl(lesson.assignmentFileUrl);
  const homeworkFile = safeUrl(lesson.homeworkFileUrl);
  const hasAssignment = !!(lesson.assignment || assignmentFile);
  const hasHomework = !!(lesson.homework || homeworkFile);

  const BLUE = "linear-gradient(150deg, #5aa0fb 0%, #2f6ef0 100%)";
  const TEALG = "linear-gradient(150deg, #46d8b8 0%, #0f9a90 100%)";
  const VIOLET = "linear-gradient(150deg, #b07bff 0%, #7c3aed 100%)";

  const navBtn =
    "flex h-[54px] flex-1 items-center gap-2.5 rounded-[20px] bg-white px-3.5 text-slate-700 shadow-[0_12px_28px_-18px_rgba(15,60,80,0.6)] ring-1 ring-slate-900/[0.04] transition active:scale-[0.98]";

  return (
    <div className="pb-2">
      {/* Sahifa foni — maketdagi moviy-siyohrang o'tish */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: "linear-gradient(178deg, #e7f0fd 0%, #e9ecfb 48%, #f0eafb 100%)" }}
      />

      {/* ── Yopishqoq sarlavha ── */}
      <header className="sticky top-0 z-30 -mx-4 -mt-5 mb-3.5 flex items-center gap-3 px-4 pb-2.5 pt-5 backdrop-blur-xl [background:linear-gradient(180deg,rgba(231,240,253,0.94)_0%,rgba(233,238,252,0.78)_100%)]">
        <Link
          href={`/student/kurse/${code}`}
          aria-label={t.back}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white shadow-[0_10px_22px_-10px_rgba(47,110,240,0.95)] transition active:scale-95"
          style={{ background: BLUE }}
        >
          <IcoBack />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[19px] font-extrabold tracking-[-0.02em] text-slate-900">{unitLabel}</div>
          <div className="truncate text-[13px] font-medium text-slate-400">{lesson.title}</div>
        </div>

        <HeaderBadges />
      </header>

      <div className="space-y-3.5">
        {/* ── 1. Dars videosi ── */}
        <LessonVideo
          mode={mode}
          src={mode === "embed" ? embed : video}
          title={unitLabel}
          kicker={`${t.lesson} ${pos + 1}/${Math.max(levelLessons.length, 1)}`}
          badge={unitNo}
          pill={lesson.title}
          openLabel={t.openVideo}
          emptyLabel={t.noVideoYet}
          lessonId={lesson.id}
          watched={!!view}
          markLabel={t.markWatched}
          doneLabel={t.watchedDone}
        />

        {/* ── 2. Dars nomi va tavsifi ── */}
        <section className="relative overflow-hidden rounded-[26px] bg-white p-4 shadow-[0_16px_38px_-22px_rgba(15,60,80,0.55)] ring-1 ring-slate-900/[0.04]">
          <Wash color="rgba(96,165,250,0.20)" />
          <div className="relative flex gap-3.5">
            <span
              className="grid h-[56px] w-[56px] shrink-0 place-items-center rounded-[19px] text-white shadow-[0_10px_20px_-8px_rgba(15,60,80,0.65)]"
              style={{ background: BLUE }}
            >
              <IcoBook />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-[#e3edfd] px-2.5 py-[3px] text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-[#2f6ef0]">
                  {lvl.code} · {unitLabel}
                </span>
                {done && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-[3px] text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-emerald-700">
                    <IcoCheck /> {t.watched}
                  </span>
                )}
              </div>

              <h1 className="mt-1.5 break-words text-[22px] font-extrabold leading-[1.18] tracking-[-0.02em] text-slate-900">
                {lesson.title}
              </h1>

              {lesson.topic ? (
                <p className="mt-1 whitespace-pre-wrap break-words text-[14.5px] leading-[1.6] text-slate-400">{lesson.topic}</p>
              ) : null}
            </div>
          </div>
        </section>

        {/* ── 3. Dars topshirig'i ── */}
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

        {/* ── 4. Uyga vazifa ── */}
        {hasHomework && (
          <TaskCard
            title={t.homeworkTask}
            icon={<IcoHome />}
            accent={VIOLET}
            tint="#f4eeff"
            wash="rgba(167,139,250,0.24)"
            body={lesson.homework}
            fileUrl={homeworkFile}
            t={t}
          />
        )}

        {!video && !hasAssignment && !hasHomework && (
          <div className="rounded-[26px] bg-white px-5 py-12 text-center shadow-[0_16px_38px_-22px_rgba(15,60,80,0.55)] ring-1 ring-slate-900/[0.04]">
            <div className="text-[14.5px] font-semibold text-slate-700">{t.noMaterial}</div>
          </div>
        )}

        {/* ── 5. Oldingi / keyingi dars ── */}
        {(prev || next) && (
          <nav className="flex gap-2.5 pt-0.5">
            {prev ? (
              <Link href={`/student/kurse/${code}/${prev.id}`} className={navBtn}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eef3fd] text-[#2f6ef0]">
                  <IcoBack s={16} />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">{t.prevLesson}</span>
                  <span className="block truncate text-[12.5px] font-semibold leading-tight">{prev.title}</span>
                </span>
              </Link>
            ) : (
              <span className="flex-1" />
            )}

            {next ? (
              <Link href={`/student/kurse/${code}/${next.id}`} className={navBtn}>
                <span className="min-w-0 flex-1 text-right">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">{t.nextLesson}</span>
                  <span className="block truncate text-[12.5px] font-semibold leading-tight">{next.title}</span>
                </span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eef3fd] text-[#2f6ef0]">
                  <IcoChevron s={16} color="currentColor" />
                </span>
              </Link>
            ) : (
              <span className="flex-1" />
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
