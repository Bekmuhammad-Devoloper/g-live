import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import MissingStudent from "../../MissingStudent";
import { LEVELS, LEVEL_BG, LEVEL_NAME } from "../levels";

// Daraja ichi — maketdagi "Unit" ekrani.
// Har dars (CourseLesson) bitta unit: ichida Vocabulary / Video lesson / Exercises
// kartalari, videoning yonida yashil "Test" paneli.

const safeUrl = (u: string | null | undefined) => (u && /^(\/uploads\/|https?:\/\/)/.test(u) ? u : null);

function IcoBack({ s = 22 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}
function IcoKey({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9M18 12v3.4M15.4 12v2.4" />
    </svg>
  );
}
function IcoBookmark({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#0f172a" stroke="#0f172a" strokeWidth="2" strokeLinejoin="round">
      <path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.2L5.5 20.5v-16a1 1 0 0 1 1-1Z" />
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

// Tog' siluetti (Vocabulary / Exercises kartalari foni)
function Mountains({ opacity = 0.3 }: { opacity?: number }) {
  return (
    <svg viewBox="0 0 340 90" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[70%] w-full" style={{ opacity }}>
      <path d="M0 90 L58 30 L96 60 L150 14 L206 64 L252 36 L300 72 L340 42 L340 90 Z" fill="white" />
      <path d="M0 90 L40 56 L86 80 L140 48 L188 84 L240 60 L292 88 L340 68 L340 90 Z" fill="white" opacity="0.5" />
    </svg>
  );
}

/** Vocabulary / Exercises kabi jarayon kartasi */
function ProgressCard({
  title, sub, pct, bg,
}: { title: string; sub: string; pct: number; bg: string }) {
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

/** Video kartasi + yonida yashil "Test" paneli */
function VideoCard({
  kind, title, watched, score, href,
}: { kind: string; title: string; watched: boolean; score: number | null; href: string | null }) {
  return (
    <div className="flex overflow-hidden rounded-[20px] shadow-[0_10px_22px_rgba(19,78,94,0.2)]">
      {/* chap: video */}
      <div className="relative flex min-h-[104px] flex-1 flex-col justify-end bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 p-3.5">
        {watched && (
          <span className="absolute left-3 top-3 rounded-md bg-emerald-600 px-2 py-[3px] text-[10.5px] font-bold text-white">
            Watched
          </span>
        )}
        <span className="absolute left-3.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/20 backdrop-blur-sm">
          <IcoPlay />
        </span>
        <div className="relative pl-[52px]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/60">{kind}</div>
          <div className="truncate text-[15px] font-extrabold text-white">{title}</div>
        </div>
      </div>

      {/* o'ng: test paneli */}
      {href ? (
        <Link href={href} className="flex w-[74px] shrink-0 flex-col items-center justify-between bg-emerald-600 py-3 text-white">
          <span className="text-[12.5px] font-bold">Test</span>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white">
            <IcoArrowRight />
          </span>
          <span className="text-[13px] font-extrabold">{score !== null ? `${score}%` : "—"}</span>
        </Link>
      ) : (
        <div className="flex w-[74px] shrink-0 flex-col items-center justify-center gap-1 bg-emerald-600/60 py-3 text-white">
          <span className="text-[12.5px] font-bold">Test</span>
          <span className="text-[11px] text-white/80">bald</span>
        </div>
      )}
    </div>
  );
}

export default async function StudentLevelPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  const code = level.toUpperCase();
  if (!(LEVELS as readonly string[]).includes(code)) notFound();

  const session = await getSession();
  if (!session) redirect("/login");

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      currentLevel: true,
      enrollments: {
        where: { isActive: true },
        orderBy: { joinedAt: "desc" },
        select: { group: { select: { id: true, levelCode: true, programId: true, program: { select: { name: true } } } } },
      },
    },
  });
  if (!student) return <MissingStudent />;

  const group = student.enrollments[0]?.group ?? null;

  const [allLessons, progress, submissions] = await Promise.all([
    group
      ? prisma.courseLesson.findMany({ where: { programId: group.programId }, orderBy: { order: "asc" } })
      : Promise.resolve([]),
    group
      ? prisma.groupLessonProgress.findMany({ where: { groupId: group.id, taught: true }, select: { courseLessonId: true } })
      : Promise.resolve([]),
    prisma.submission.findMany({
      where: { studentId: student.id, status: "GRADED" },
      orderBy: { createdAt: "desc" },
      select: { score: true },
      take: 20,
    }),
  ]);

  const fallback = (group?.levelCode ?? student.currentLevel ?? "A1").slice(0, 2).toUpperCase();
  const lessons = allLessons.filter((l) => (l.levelCode ?? fallback).toUpperCase() === code);
  const taught = new Set(progress.map((p) => p.courseLessonId));
  const avgScore = submissions.length
    ? Math.round(submissions.reduce((n, x) => n + (x.score ?? 0), 0) / submissions.length)
    : null;

  const bg = LEVEL_BG[code];
  const exercisesBg = "linear-gradient(135deg, #5b21b6 0%, #7c3aed 55%, #a78bfa 100%)";

  return (
    <div className="space-y-4">
      {/* Sarlavha — maketdagidek: orqaga · nom · kalit + xatcho'p */}
      <div className="flex items-center gap-3 pt-1">
        <Link href="/student/kurse" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-[0_6px_16px_rgba(19,78,94,0.12)]">
          <IcoBack />
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-[18px] font-extrabold text-slate-900">
            {code} · {LEVEL_NAME[code]}
          </div>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-[0_6px_16px_rgba(19,78,94,0.12)]">
          <IcoKey />
        </span>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-[0_6px_16px_rgba(19,78,94,0.12)]">
          <IcoBookmark />
        </span>
      </div>

      {lessons.length === 0 ? (
        <div className="rounded-[24px] bg-white/85 px-5 py-12 text-center shadow-[0_12px_28px_rgba(19,78,94,0.10)]">
          <div className="text-[15px] font-semibold text-slate-700">Für {code} sind noch keine Lektionen da.</div>
          <p className="mt-1 text-[13px] text-slate-400">Die Lehrkraft fügt sie bald hinzu.</p>
        </div>
      ) : (
        lessons.map((l, i) => {
          const done = taught.has(l.id);
          const words = (l.topic ?? "").split(/[,;\n]/).filter((x) => x.trim()).length;
          const hasVideo = !!safeUrl(l.videoUrl);
          const hasEx = !!(l.assignment || l.homework || l.assignmentFileUrl || l.homeworkFileUrl);
          return (
            <div key={l.id} className="space-y-3">
              {/* Unit sarlavhasi */}
              <div className="px-1 pt-1 text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Unit {code.slice(1)}.{i + 1} · {l.title}
              </div>

              {/* Vocabulary */}
              <ProgressCard
                title="Vocabulary"
                sub={`${words || 0} words`}
                pct={done ? 100 : 0}
                bg={bg}
              />

              {/* Video lesson + Test */}
              {hasVideo && (
                <VideoCard
                  kind="THEORIE"
                  title={l.title}
                  watched={done}
                  score={avgScore}
                  href={safeUrl(l.videoUrl)}
                />
              )}

              {/* Exercises */}
              {hasEx && (
                <ProgressCard
                  title="Exercises"
                  sub={`${[l.assignment, l.homework].filter(Boolean).length} exercise`}
                  pct={done ? 100 : 0}
                  bg={exercisesBg}
                />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
