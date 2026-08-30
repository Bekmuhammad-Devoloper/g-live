import Link from "next/link";
import { S, type StudentStrings } from "../../../_i18n";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import MissingStudent from "../../../MissingStudent";
import { getActiveLevels } from "@/lib/studyLevels";
import { levelGradient } from "@/lib/levelColor";
import HeaderBadges from "../../../HeaderBadges";

// Unit ichi — Vocabulary / Video lesson (+ Test) / Exercises kartalari.

const safeUrl = (u: string | null | undefined) => (u && /^(\/uploads\/|https?:\/\/)/.test(u) ? u : null);

function IcoBack({ s = 22 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}
function IcoStar({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#f5b301">
      <path d="M12 3.1l2.75 5.57 6.15.9-4.45 4.34 1.05 6.12L12 17.14l-5.5 2.89 1.05-6.12L3.1 9.57l6.15-.9L12 3.1Z" />
    </svg>
  );
}
function IcoChevronDown({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
function IcoPlay({ s = 22 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="white">
      <path d="M8 5.2v13.6L19 12 8 5.2Z" />
    </svg>
  );
}
function IcoArrowRight({ s = 18 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function Mountains({ opacity = 0.3 }: { opacity?: number }) {
  return (
    <svg viewBox="0 0 340 90" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[70%] w-full" style={{ opacity }}>
      <path d="M0 90 L58 30 L96 60 L150 14 L206 64 L252 36 L300 72 L340 42 L340 90 Z" fill="white" />
      <path d="M0 90 L40 56 L86 80 L140 48 L188 84 L240 60 L292 88 L340 68 L340 90 Z" fill="white" opacity="0.5" />
    </svg>
  );
}

function ProgressCard({ title, sub, pct, bg }: { title: string; sub: string; pct: number; bg: string }) {
  return (
    <div className="relative overflow-hidden rounded-[20px] px-4 py-4 text-white shadow-[0_10px_22px_rgba(19,78,94,0.2)]" style={{ background: bg }}>
      <Mountains />
      <div className="relative flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-sm">
          <IcoStar />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[19px] font-extrabold leading-tight">{title}</div>
          <div className="text-[12.5px] text-white/75">{sub}</div>
        </div>
        <IcoChevronDown />
      </div>
      <div className="relative mt-3 flex items-center gap-3">
        <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-white/30">
          <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[12.5px] font-bold">{pct}%</span>
      </div>
    </div>
  );
}

function VideoCard({ kind, title, watched, score, href, t }: { kind: string; title: string; watched: boolean; score: number | null; href: string | null; t: StudentStrings }) {
  return (
    <div className="flex overflow-hidden rounded-[20px] shadow-[0_10px_22px_rgba(19,78,94,0.2)]">
      <div className="relative flex min-h-[104px] flex-1 flex-col justify-end bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 p-3.5">
        {watched && (
          <span className="absolute left-3 top-3 rounded-md bg-emerald-600 px-2 py-[3px] text-[10.5px] font-bold text-white">{t.watched}</span>
        )}
        <span className="absolute left-3.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/20 backdrop-blur-sm">
          <IcoPlay />
        </span>
        <div className="relative pl-[52px]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/60">{kind}</div>
          <div className="truncate text-[15px] font-extrabold text-white">{title}</div>
        </div>
      </div>
      {href ? (
        <Link href={href} className="flex w-[74px] shrink-0 flex-col items-center justify-between bg-emerald-600 py-3 text-white">
          <span className="text-[12.5px] font-bold">Test</span>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white"><IcoArrowRight /></span>
          <span className="text-[13px] font-extrabold">{score !== null ? `${score}%` : "—"}</span>
        </Link>
      ) : (
        <div className="flex w-[74px] shrink-0 flex-col items-center justify-center gap-1 bg-emerald-600/60 py-3 text-white">
          <span className="text-[12.5px] font-bold">Test</span>
          <span className="text-[11px] text-white/80">{t.soon}</span>
        </div>
      )}
    </div>
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

  const [lesson, allLessons, progress, submissions] = await Promise.all([
    prisma.courseLesson.findUnique({ where: { id: unit } }),
    prisma.courseLesson.findMany({
      where: { programId: group.programId },
      orderBy: { order: "asc" },
      select: { id: true, levelCode: true },
    }),
    prisma.groupLessonProgress.findMany({ where: { groupId: group.id, taught: true }, select: { courseLessonId: true } }),
    prisma.submission.findMany({
      where: { studentId: student.id, status: "GRADED" },
      orderBy: { createdAt: "desc" },
      select: { score: true },
      take: 20,
    }),
  ]);

  // Boshqa kursning darsiga URL orqali kirib bo'lmasin
  if (!lesson || lesson.programId !== group.programId) notFound();

  const fallback = (group.levelCode ?? student.currentLevel ?? "A1").slice(0, 2).toUpperCase();
  const levelLessons = allLessons.filter((l) => (l.levelCode ?? fallback).toUpperCase() === code);
  const idx = levelLessons.findIndex((l) => l.id === lesson.id);
  const chapter = Math.floor(Math.max(0, idx) / 3) + 1;
  const inChapter = (Math.max(0, idx) % 3) + 1;

  const done = new Set(progress.map((p) => p.courseLessonId)).has(lesson.id);
  const avgScore = submissions.length
    ? Math.round(submissions.reduce((n, x) => n + (x.score ?? 0), 0) / submissions.length)
    : null;

  const words = (lesson.topic ?? "").split(/[,;\n]/).filter((x) => x.trim()).length;
  const hasVideo = !!safeUrl(lesson.videoUrl);
  const hasEx = !!(lesson.assignment || lesson.homework || lesson.assignmentFileUrl || lesson.homeworkFileUrl);
  const exercisesBg = "linear-gradient(135deg, #5b21b6 0%, #7c3aed 55%, #a78bfa 100%)";

  return (
    <div className="space-y-3.5">
      {/* Sarlavha — orqaga · Unit nomi · kalit + xatcho'p */}
      <div className="flex items-center gap-3 pt-1">
        <Link href={`/student/kurse/${code}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-[0_6px_16px_rgba(19,78,94,0.12)]">
          <IcoBack />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[18px] font-extrabold text-slate-900">Unit {chapter}.{inChapter}</div>
          <div className="truncate text-[12px] text-slate-400">{lesson.title}</div>
        </div>
        <HeaderBadges />
      </div>

      <ProgressCard title={t.vocabulary} sub={`${words} ${t.words.toLowerCase()}`} pct={done ? 100 : 0} bg={levelGradient(lvl.color)} />

      {hasVideo && (
        <VideoCard kind={t.theory} title={lesson.title} watched={done} score={avgScore} href={safeUrl(lesson.videoUrl)} t={t} />
      )}

      {hasEx && (
        <ProgressCard
          title={t.exercises}
          sub={`${[lesson.assignment, lesson.homework].filter(Boolean).length} ${t.exercises.toLowerCase()}`}
          pct={done ? 100 : 0}
          bg={exercisesBg}
        />
      )}

      {!hasVideo && !hasEx && (
        <div className="rounded-[20px] bg-white/85 px-5 py-10 text-center shadow-[0_10px_22px_rgba(19,78,94,0.10)]">
          <div className="text-[14px] font-semibold text-slate-700">{t.noMaterial}</div>
        </div>
      )}
    </div>
  );
}
