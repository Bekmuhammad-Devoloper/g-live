import Link from "next/link";
import { S, type StudentStrings } from "../../../_i18n";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import MissingStudent from "../../../MissingStudent";
import { getActiveLevels } from "@/lib/studyLevels";
import HeaderBadges from "../../../HeaderBadges";
import LessonVideo, { type VideoMode } from "./LessonVideo";
import LessonTasks, { type VTask } from "./LessonTasks";
import { looksLikeVocabulary, parseLessonWords } from "@/lib/lessonWords";

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

function IcoPlayCircle({ s = 24 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.2" />
      <path d="M10.2 8.6v6.8l5.6-3.4-5.6-3.4Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IcoWords({ s = 24 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5.2h7.2v13.6H4z" />
      <path d="M12.8 5.2H20v13.6h-7.2z" />
      <path d="M6.2 9.2h2.8M6.2 12.4h2.8M15 9.2h2.8M15 12.4h2.8" />
    </svg>
  );
}

/* ── Dars ichidagi bo'lim kartasi (uch ustun) ── */
// Bo'lim `?tab=` orqali almashadi: sahifa server komponenti bo'lib qoladi,
// har bo'limga to'g'ridan-to'g'ri havola berish mumkin va telefonning
// "orqaga" tugmasi ham to'g'ri ishlaydi.
function TabCard({
  href, active, icon, label, meta, accent,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  meta: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "flex min-h-[104px] flex-col items-center justify-center gap-1.5 rounded-[22px] px-1.5 py-3 text-center transition active:scale-[0.97] " +
        (active ? "text-white shadow-[0_12px_24px_-12px_rgba(15,60,80,0.75)]" : "gl-glass text-slate-700")
      }
      style={active ? { background: accent } : undefined}
    >
      <span
        className="grid h-[38px] w-[38px] place-items-center rounded-[13px]"
        style={active ? { background: "rgba(255,255,255,0.22)" } : { background: "rgba(255,255,255,0.6)", color: "#0e7490" }}
      >
        {icon}
      </span>
      <span className="text-[13px] font-extrabold leading-none">{label}</span>
      <span className={"text-[10.5px] font-semibold leading-none " + (active ? "text-white/80" : "text-slate-600")}>{meta}</span>
    </Link>
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
  // Rasm bo'lsa — bitta blok: ustida rasmning o'zi, ostida ingichka qator.
  // Ilgari rasm ham, alohida "Faylni ochish" qatori ham chizilar edi va
  // bitta narsa ikki marta ko'rinardi.
  if (isImage(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-3 block overflow-hidden rounded-[18px] ring-1 ring-slate-900/[0.06] transition active:scale-[0.99]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={t.attachment} className="max-h-[290px] w-full bg-white object-contain" />
        <span className="flex items-center gap-2.5 px-3 py-2.5" style={{ background: tint }}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white" style={{ color: accent }}>
            <IcoExpand s={13} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-slate-700">{t.openFull}</span>
          <span className="shrink-0 text-[11px] font-semibold text-slate-400">{fileKind(url)}</span>
          <IcoChevron s={15} />
        </span>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-3 flex items-center gap-3 rounded-[18px] px-3 py-2.5 transition active:scale-[0.985]"
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
    <section className="gl-glass relative overflow-hidden rounded-[26px] p-4">
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
            <p className="mt-1 whitespace-pre-wrap break-words text-[14.5px] leading-[1.6] text-slate-500">{body}</p>
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

export default async function StudentUnitPage({
  params,
  searchParams,
}: {
  params: Promise<{ level: string; unit: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { level, unit } = await params;
  const sp = await searchParams;
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

  const [lesson, allLessons, progress, view, tasks] = await Promise.all([
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
    // Shu darsga bog'langan vazifalar (faqat o'quvchining o'z guruhidan)
    prisma.assignment.findMany({
      where: { courseLessonId: unit, groupId: group.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, title: true, type: true, maxScore: true, dueAt: true, note: true, createdAt: true,
        submissions: {
          where: { studentId: student.id },
          orderBy: { attempt: "desc" },
          select: {
            id: true, attempt: true, content: true, fileUrl: true, score: true,
            status: true, teacherNote: true, gradedAt: true, createdAt: true,
            gradedBy: { select: { fullName: true } },
          },
        },
        _count: { select: { submissions: { where: { status: "GRADED" } } } },
      },
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

  const video = safeUrl(lesson.videoUrl);
  const embed = video && !isUpload(video) ? embedUrl(video) : null;
  const mode: VideoMode = !video ? "none" : isUpload(video) ? "file" : embed ? "embed" : "link";

  const assignmentFile = safeUrl(lesson.assignmentFileUrl);
  const homeworkFile = safeUrl(lesson.homeworkFileUrl);
  const hasAssignment = !!(lesson.assignment || assignmentFile);
  const hasHomework = !!(lesson.homework || homeworkFile);

  // Darsning lug'ati mavzu maydonidan ajratiladi (lib/lessonWords.ts).
  // O'qituvchi u yerga gap ko'rinishidagi tavsif yozgan bo'lsa lug'at
  // sifatida ko'rsatilmaydi — o'sha holda tavsif "Dars" bo'limida chiqadi.
  const words = parseLessonWords(lesson.topic);
  const hasVocab = words.length > 0 && looksLikeVocabulary(words);
  const taskCount = vTasks.length + (hasHomework ? 1 : 0);

  const tab = sp.tab === "lugat" || sp.tab === "vazifa" ? sp.tab : "dars";

  const BLUE = "linear-gradient(150deg, #5aa0fb 0%, #2f6ef0 100%)";
  const TEALG = "linear-gradient(150deg, #46d8b8 0%, #0f9a90 100%)";
  const VIOLET = "linear-gradient(150deg, #b07bff 0%, #7c3aed 100%)";

  const navBtn =
    "gl-glass flex h-[54px] flex-1 items-center gap-2.5 rounded-[20px] px-3.5 text-slate-700 transition active:scale-[0.98]";

  return (
    <div className="pb-2">
      {/* Sahifa o'z fonini CHIZMAYDI: layout'dagi ambient qatlam ko'rinib
          tursin — shisha kartalar aynan o'shani sindiradi. Bu yerda `-z-10`
          qatlam layout'ning `relative z-10` o'ramidan chiqa olmasdi va
          ambientni berkitib, butun sahifadagi shishani bekor qilardi. */}

      {/* ── Yopishqoq sarlavha ── */}
      <header className="sticky top-0 z-30 -mx-4 -mt-5 mb-3.5 flex items-center gap-3 bg-[#e6f0f6] px-4 pb-2.5 pt-5">
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
          <div className="truncate text-[13px] font-medium text-slate-600">{lesson.title}</div>
        </div>

        <HeaderBadges />
      </header>

      {/* ── Uch bo'lim: Lug'at · Dars · Vazifa ── */}
      <div className="grid grid-cols-3 gap-2">
        <TabCard
          href="?tab=lugat"
          active={tab === "lugat"}
          icon={<IcoWords s={22} />}
          label={t.vocabulary}
          meta={hasVocab ? `${words.length} ${t.wordCount}` : "—"}
          accent="linear-gradient(150deg, #f6c453 0%, #e09217 100%)"
        />
        <TabCard
          href="?tab=dars"
          active={tab === "dars"}
          icon={<IcoPlayCircle s={22} />}
          label={t.lesson}
          meta={view ? t.watched : mode === "none" ? "—" : t.openVideo}
          accent="linear-gradient(150deg, #2fb9dc 0%, #0e7490 100%)"
        />
        <TabCard
          href="?tab=vazifa"
          active={tab === "vazifa"}
          icon={<IcoClipboard s={22} />}
          label={t.tabTasks}
          meta={taskCount > 0 ? String(taskCount) : "—"}
          accent="linear-gradient(150deg, #b07bff 0%, #7c3aed 100%)"
        />
      </div>

      <div className="mt-3.5 space-y-3.5">
        {/* ── Lug'at bo'limi ── */}
        {tab === "lugat" &&
          (hasVocab ? (
            <section className="gl-glass overflow-hidden rounded-[26px]">
              <div className="flex items-center gap-2.5 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[13px] text-white" style={{ background: "linear-gradient(150deg,#f6c453,#e09217)" }}>
                  <IcoWords s={19} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold text-slate-900">{t.vocabulary}</span>
                <span className="shrink-0 text-[12px] font-bold text-slate-600">
                  {words.length} {t.wordCount}
                </span>
              </div>
              <ul className="border-t border-white/50">
                {words.map((w) => (
                  <li key={w.de} className="grid grid-cols-[1fr_1fr] gap-3 border-b border-white/40 px-4 py-2.5 last:border-0">
                    <span className="break-words text-[14.5px] font-bold leading-snug text-slate-900">{w.de}</span>
                    <span className="break-words text-[14px] leading-snug text-slate-600">{w.uz ?? "—"}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <div className="gl-glass rounded-[26px] px-5 py-12 text-center">
              <div className="text-[14.5px] font-semibold text-slate-700">{t.noWordsInLesson}</div>
            </div>
          ))}

        {/* ── Dars bo'limi ── */}
        {tab === "dars" && (
        <>
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
        <section className="gl-glass relative overflow-hidden rounded-[26px] p-4">
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

              {/* Mavzu maydoni lug'at bo'lsa u "Lug'at" bo'limida chiqadi —
                  bu yerda takrorlanmaydi. Tavsif bo'lsa esa shu yerda. */}
              {lesson.topic && !hasVocab ? (
                <p className="mt-1 whitespace-pre-wrap break-words text-[14.5px] leading-[1.6] text-slate-600">{lesson.topic}</p>
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

        {!video && !hasAssignment && (
          <div className="gl-glass rounded-[26px] px-5 py-12 text-center">
            <div className="text-[14.5px] font-semibold text-slate-700">{t.noMaterial}</div>
          </div>
        )}
        </>
        )}

        {/* ── Vazifa bo'limi ── */}
        {tab === "vazifa" && (
        <>
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

        {/* Topshirish va o'qituvchi izohi */}
        <LessonTasks tasks={vTasks} />

        {!hasHomework && vTasks.length === 0 && (
          <div className="gl-glass rounded-[26px] px-5 py-12 text-center">
            <div className="text-[14.5px] font-semibold text-slate-700">{t.noTasksInLesson}</div>
          </div>
        )}
        </>
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
                  <span className="block text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">{t.prevLesson}</span>
                  <span className="block truncate text-[12.5px] font-semibold leading-tight">{prev.title}</span>
                </span>
              </Link>
            ) : null}

            {next ? (
              <Link href={`/student/kurse/${code}/${next.id}`} className={navBtn}>
                <span className="min-w-0 flex-1 text-right">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">{t.nextLesson}</span>
                  <span className="block truncate text-[12.5px] font-semibold leading-tight">{next.title}</span>
                </span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eef3fd] text-[#2f6ef0]">
                  <IcoChevron s={16} color="currentColor" />
                </span>
              </Link>
            ) : null}
          </nav>
        )}
      </div>
    </div>
  );
}
