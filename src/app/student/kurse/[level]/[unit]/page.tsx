import Link from "next/link";
import { S, type StudentStrings } from "../../../_i18n";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import MissingStudent from "../../../MissingStudent";
import { getActiveLevels } from "@/lib/studyLevels";
import { levelGradient } from "@/lib/levelColor";
import HeaderBadges from "../../../HeaderBadges";

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
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 5.5-6.5 6.5 6.5 6.5" />
    </svg>
  );
}
function IcoPlay({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.2v13.6L19 12 8 5.2Z" />
    </svg>
  );
}
function IcoClipboard({ s = 17 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4h6v3H9z" />
      <path d="M15 5.5h2.5A1.5 1.5 0 0 1 19 7v12a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V7a1.5 1.5 0 0 1 1.5-1.5H9" />
      <path d="M8.5 12.5h7M8.5 16.5h4.5" />
    </svg>
  );
}
function IcoHome({ s = 17 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3.5 10.5 8.5-7 8.5 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5.5h4V20" />
    </svg>
  );
}
function IcoFile({ s = 17 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5Z" />
      <path d="M13.5 3.5v5h5" />
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
function IcoExpand({ s = 15 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4h6v6M20 4l-7.5 7.5M10 20H4v-6M4 20l7.5-7.5" />
    </svg>
  );
}

/* ── Biriktirilgan fayl: rasm bo'lsa darhol ko'rinadi, aks holda tugma ── */
function Attachment({ url, accent, tint, t }: { url: string; accent: string; tint: string; t: StudentStrings }) {
  if (isImage(url)) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="group relative mt-3 block overflow-hidden rounded-2xl bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={t.attachment} className="max-h-[420px] w-full object-contain" />
        <span className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
          <IcoExpand /> {t.openFull}
        </span>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-3 flex items-center gap-3 rounded-2xl px-3.5 py-3 transition active:scale-[0.985]"
      style={{ background: tint }}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white shadow-sm" style={{ color: accent }}>
        <IcoFile />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-bold leading-tight text-slate-800">{t.openFile}</span>
        <span className="block text-[11.5px] font-medium leading-tight text-slate-500">{fileKind(url)}</span>
      </span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="m9 6 6 6-6 6" />
      </svg>
    </a>
  );
}

/* ── Dars topshirig'i / uyga vazifa bloki ── */
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
    <section className="rounded-[24px] bg-white p-4 shadow-[0_14px_34px_-18px_rgba(15,60,80,0.45)] ring-1 ring-slate-900/[0.05]">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[13px] text-white shadow-sm" style={{ background: accent }}>
          {icon}
        </span>
        <h2 className="text-[15px] font-extrabold leading-tight tracking-[-0.01em] text-slate-900">{title}</h2>
      </div>

      {body ? (
        <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-[1.68] text-slate-700">{body}</p>
      ) : null}

      {fileUrl ? <Attachment url={fileUrl} accent={accent} tint={tint} t={t} /> : null}
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
      select: { id: true, levelCode: true, title: true },
    }),
    prisma.groupLessonProgress.findMany({ where: { groupId: group.id, taught: true }, select: { courseLessonId: true } }),
  ]);

  // Boshqa kursning darsiga URL orqali kirib bo'lmasin
  if (!lesson || lesson.programId !== group.programId) notFound();

  const fallback = (group.levelCode ?? student.currentLevel ?? "A1").slice(0, 2).toUpperCase();
  const levelLessons = allLessons.filter((l) => (l.levelCode ?? fallback).toUpperCase() === code);
  const idx = levelLessons.findIndex((l) => l.id === lesson.id);
  const pos = Math.max(0, idx);
  const chapter = Math.floor(pos / 3) + 1;
  const inChapter = (pos % 3) + 1;
  const unitLabel = `Unit ${chapter}.${inChapter}`;
  const prev = idx > 0 ? levelLessons[idx - 1] : null;
  const next = idx >= 0 && idx < levelLessons.length - 1 ? levelLessons[idx + 1] : null;

  const done = new Set(progress.map((p) => p.courseLessonId)).has(lesson.id);

  const video = safeUrl(lesson.videoUrl);
  const embed = video && !isUpload(video) ? embedUrl(video) : null;
  const assignmentFile = safeUrl(lesson.assignmentFileUrl);
  const homeworkFile = safeUrl(lesson.homeworkFileUrl);
  const hasAssignment = !!(lesson.assignment || assignmentFile);
  const hasHomework = !!(lesson.homework || homeworkFile);

  const navBtn =
    "flex h-[52px] flex-1 items-center gap-2 rounded-[18px] bg-white px-3.5 text-slate-700 shadow-[0_10px_26px_-16px_rgba(15,60,80,0.5)] ring-1 ring-slate-900/[0.05] transition active:scale-[0.98]";

  return (
    <div className="pb-2">
      {/* ── Yopishqoq sarlavha ── */}
      <header className="sticky top-0 z-30 -mx-4 -mt-5 mb-3.5 flex items-center gap-3 border-b border-slate-900/[0.06] bg-[#e4edf3]/85 px-4 pb-2.5 pt-5 backdrop-blur-xl">
        <Link
          href={`/student/kurse/${code}`}
          aria-label={t.back}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-slate-800 shadow-[0_6px_16px_-6px_rgba(15,60,80,0.5)] ring-1 ring-slate-900/[0.05] transition active:scale-95"
        >
          <IcoBack />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-extrabold tracking-[-0.01em] text-slate-900">{unitLabel}</div>
          {levelLessons.length > 0 && (
            <div className="text-[11.5px] font-semibold text-slate-400">
              {lvl.code} · {pos + 1}/{levelLessons.length}
            </div>
          )}
        </div>

        <HeaderBadges />
      </header>

      <div className="space-y-3.5">
        {/* ── 1. Dars videosi ── */}
        <div className="overflow-hidden rounded-[24px] bg-slate-950 shadow-[0_20px_44px_-22px_rgba(2,20,32,0.8)] ring-1 ring-white/5">
          {video && isUpload(video) ? (
            // Vertikal (telefonda olingan) videolar ham to'g'ri nisbatda ko'rinsin
            <video
              src={video}
              controls
              playsInline
              preload="metadata"
              className="mx-auto block max-h-[62vh] w-auto max-w-full"
            />
          ) : embed ? (
            <iframe
              src={embed}
              title={lesson.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              className="aspect-video w-full border-0"
            />
          ) : video ? (
            <a
              href={video}
              target="_blank"
              rel="noreferrer"
              className="group flex aspect-video w-full flex-col items-center justify-center gap-3 bg-[radial-gradient(120%_100%_at_50%_0%,#1e3a4d_0%,#0b1620_100%)] transition active:scale-[0.99]"
            >
              <span className="grid h-16 w-16 place-items-center rounded-full bg-white/10 pl-1 text-white ring-1 ring-white/20 backdrop-blur-sm">
                <IcoPlay />
              </span>
              <span className="text-[13.5px] font-bold text-white/90">{t.openVideo}</span>
            </a>
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-[radial-gradient(120%_100%_at_50%_0%,#1e3a4d_0%,#0b1620_100%)]">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-white/[0.07] pl-1 text-white/45 ring-1 ring-white/10">
                <IcoPlay />
              </span>
              <span className="max-w-[240px] text-center text-[12.5px] font-medium leading-snug text-white/45">{t.noVideoYet}</span>
            </div>
          )}
        </div>

        {/* ── 2. Dars nomi va tavsifi ── */}
        <section className="rounded-[24px] bg-white px-5 pb-[18px] pt-4 shadow-[0_14px_34px_-18px_rgba(15,60,80,0.45)] ring-1 ring-slate-900/[0.05]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="rounded-full px-2.5 py-[4px] text-[10px] font-extrabold uppercase tracking-[0.06em] text-white shadow-sm"
              style={{ background: levelGradient(lvl.color) }}
            >
              {lvl.code} · {unitLabel}
            </span>
            {done && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-[4px] text-[10px] font-extrabold uppercase tracking-[0.06em] text-emerald-700 ring-1 ring-emerald-600/15">
                <IcoCheck /> {t.watched}
              </span>
            )}
          </div>

          <h1 className="mt-2.5 break-words text-[23px] font-extrabold leading-[1.2] tracking-[-0.02em] text-slate-900">
            {lesson.title}
          </h1>

          {lesson.topic ? (
            <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-[1.68] text-slate-500">{lesson.topic}</p>
          ) : null}
        </section>

        {/* ── 3. Dars topshirig'i ── */}
        {hasAssignment && (
          <TaskCard
            title={t.lessonAssignment}
            icon={<IcoClipboard />}
            accent="linear-gradient(135deg, #17a2bf, #0e7490)"
            tint="#eefaff"
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
            accent="linear-gradient(135deg, #a78bfa, #7c3aed)"
            tint="#f5f1ff"
            body={lesson.homework}
            fileUrl={homeworkFile}
            t={t}
          />
        )}

        {!video && !hasAssignment && !hasHomework && (
          <div className="rounded-[24px] bg-white px-5 py-12 text-center shadow-[0_14px_34px_-18px_rgba(15,60,80,0.45)] ring-1 ring-slate-900/[0.05]">
            <div className="text-[14.5px] font-semibold text-slate-700">{t.noMaterial}</div>
          </div>
        )}

        {/* ── 5. Oldingi / keyingi dars ── */}
        {(prev || next) && (
          <nav className="flex gap-2.5 pt-0.5">
            {prev ? (
              <Link href={`/student/kurse/${code}/${prev.id}`} className={navBtn}>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
                  <IcoBack s={15} />
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
                <span className="grid h-7 w-7 shrink-0 rotate-180 place-items-center rounded-full bg-slate-100 text-slate-500">
                  <IcoBack s={15} />
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
