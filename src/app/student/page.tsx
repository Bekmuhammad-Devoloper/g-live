import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Icon } from "../(app)/_components/Icon";

// O'quvchi "Start" ekrani — nemis tili o'rganish ilovasi maketi bilan birma-bir:
// salomlashish, 4 ko'nikma kartasi, kurs jarayoni, tanga/seriya/reyting,
// reklama banneri va "Videos & Podcasts" bloki. Hammasi HAQIQIY ma'lumotdan:
//   Wörter   — imtihon natijalari o'rtachasi
//   Lesen    — baholangan uy vazifalari o'rtachasi
//   Hören    — davomat foizi (keldi/darslar)
//   Sprechen — guruh kursining o'tilgan darslari foizi
//   Münzen   — keldi×5 + baholangan vazifa×10
//   Streak   — so'nggi ketma-ket qatnashgan darslar
//   Rang     — guruhdoshlar orasida davomat bo'yicha o'rin (Top X%)

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function Ring({ pct, size = 58 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#d7e6ee" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#0e7490" strokeWidth={5}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
      />
    </svg>
  );
}

export default async function StudentStartPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      fullName: true,
      currentLevel: true,
      enrollments: {
        where: { isActive: true },
        orderBy: { joinedAt: "desc" },
        select: { groupId: true, group: { select: { id: true, name: true, levelCode: true, programId: true, program: { select: { name: true } } } } },
      },
    },
  });
  if (!student) redirect("/dashboard");

  const group = student.enrollments[0]?.group ?? null;

  const [attendance, submissions, exams, progress, courseLessons, mates] = await Promise.all([
    prisma.attendance.findMany({
      where: { studentId: student.id },
      orderBy: { markedAt: "desc" },
      select: { status: true },
      take: 200,
    }),
    prisma.submission.findMany({ where: { studentId: student.id, status: "GRADED" }, select: { score: true } }),
    prisma.examResult.findMany({ where: { studentId: student.id }, select: { score: true } }),
    group ? prisma.groupLessonProgress.findMany({ where: { groupId: group.id, taught: true }, orderBy: { taughtAt: "desc" }, select: { courseLessonId: true } }) : Promise.resolve([]),
    group ? prisma.courseLesson.findMany({ where: { programId: group.programId }, orderBy: { order: "asc" }, select: { id: true, title: true, topic: true } }) : Promise.resolve([]),
    group
      ? prisma.groupStudent.findMany({ where: { groupId: group.id, isActive: true }, select: { studentId: true } })
      : Promise.resolve([]),
  ]);

  // ── Ko'nikmalar ──
  const present = attendance.filter((a) => a.status === "PRESENT" || a.status === "LATE");
  const hoeren = attendance.length ? clamp((present.length / attendance.length) * 100) : 0;
  const lesen = submissions.length ? clamp(submissions.reduce((n, x) => n + (x.score ?? 0), 0) / submissions.length) : 0;
  const woerter = exams.length ? clamp(exams.reduce((n, x) => n + (x.score ?? 0), 0) / exams.length) : 0;
  const sprechen = courseLessons.length ? clamp((progress.length / courseLessons.length) * 100) : 0;

  // ── Kurs jarayoni ──
  const level = group?.levelCode ?? student.currentLevel ?? "A1";
  const chapter = Math.max(1, progress.length);
  const taughtIds = new Set(progress.map((p) => p.courseLessonId));
  const currentLesson = courseLessons.find((cl) => !taughtIds.has(cl.id)) ?? courseLessons[courseLessons.length - 1] ?? null;
  const kursPct = sprechen;

  // ── Tanga / seriya ──
  const coins = present.length * 5 + submissions.length * 10;
  let streak = 0;
  for (const a of attendance) {
    if (a.status === "PRESENT" || a.status === "LATE") streak++;
    else break;
  }

  // ── Reyting (guruhdoshlar orasida davomat bo'yicha) ──
  let rangTop = 100;
  if (mates.length > 1) {
    const counts = await prisma.attendance.groupBy({
      by: ["studentId"],
      where: { studentId: { in: mates.map((m) => m.studentId) }, status: { in: ["PRESENT", "LATE"] } },
      _count: { _all: true },
    });
    const mine = counts.find((c) => c.studentId === student.id)?._count._all ?? 0;
    const better = counts.filter((c) => c._count._all > mine).length;
    rangTop = clamp(((better + 1) / mates.length) * 100) || 1;
  }

  const kurseHref = group ? `/groups/${group.id}` : "/student";
  const firstName = student.fullName.split(/\s+/)[0];

  const skills: { key: string; label: string; pct: number; icon: React.ReactNode }[] = [
    { key: "w", label: "Wörter", pct: woerter, icon: <span className="text-3xl font-extrabold leading-none text-cyan-700">W</span> },
    { key: "l", label: "Lesen", pct: lesen, icon: <Icon name="book" className="h-8 w-8 text-cyan-700" /> },
    { key: "h", label: "Hören", pct: hoeren, icon: <Icon name="headphones" className="h-8 w-8 text-cyan-700" /> },
    { key: "s", label: "Sprechen", pct: sprechen, icon: <Icon name="mic" className="h-8 w-8 text-cyan-700" /> },
  ];

  const card = "rounded-3xl border border-white/70 bg-white/70 shadow-[0_10px_25px_rgba(14,116,144,0.08)] backdrop-blur";

  return (
    <div className="space-y-5">
      {/* ── Salomlashish ── */}
      <div className="flex items-center gap-3.5">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-600 to-cyan-800 shadow-lg shadow-cyan-700/25">
          <Icon name="user" className="h-7 w-7 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold tracking-tight text-slate-900">Hallo, {firstName}!</h1>
          <p className="text-sm text-slate-500">Bereit, Deutsch zu lernen?</p>
        </div>
        <Link href="/notifications" className="grid h-11 w-11 place-items-center rounded-full bg-white/80 text-cyan-700 shadow-sm">
          <Icon name="bell" className="h-5 w-5" />
        </Link>
      </div>

      {/* ── 4 ko'nikma kartasi ── */}
      <div className="grid grid-cols-4 gap-2.5">
        {skills.map((sk) => (
          <div key={sk.key} className={`${card} flex flex-col items-center gap-2 px-1 py-4`}>
            <div className="grid h-9 place-items-center">{sk.icon}</div>
            <div className="text-[12px] font-semibold text-slate-700">{sk.label}</div>
            <div className="relative grid place-items-center">
              <Ring pct={sk.pct} size={54} />
              <span className="absolute text-[11px] font-bold text-slate-700">{sk.pct}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Kurs jarayoni ── */}
      <Link href={kurseHref} className={`${card} block bg-gradient-to-br from-cyan-100/80 to-white/60 p-5`}>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-700">Dein Fortschritt</div>
            <div className="mt-1 truncate text-3xl font-extrabold tracking-tight text-slate-900">
              {level} · Kapitel {chapter}
            </div>
            <div className="mt-1 truncate text-sm text-slate-600">
              {currentLesson?.topic || currentLesson?.title || group?.program.name || "Grundlagen des Alltags"}
            </div>
          </div>
          <div className="relative grid shrink-0 place-items-center">
            <Ring pct={kursPct} size={86} />
            <span className="absolute grid h-14 w-14 place-items-center rounded-full bg-white text-cyan-700 shadow-inner">
              <Icon name="trophy" className="h-7 w-7" />
            </span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/80">
            <div className="h-full rounded-full bg-cyan-700" style={{ width: `${kursPct}%` }} />
          </div>
          <span className="text-lg font-extrabold text-cyan-700">{kursPct}%</span>
        </div>
      </Link>

      {/* ── Münzen · Streak · Rang ── */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { icon: "coins", label: "Münzen", value: String(coins) },
          { icon: "award", label: "Streak", value: `${streak} Tage` },
          { icon: "chart", label: "Rang", value: `Top ${rangTop}%` },
        ].map((t) => (
          <div key={t.label} className={`${card} flex flex-col items-center gap-1.5 px-2 py-4`}>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-cyan-600 to-cyan-800 text-white shadow-md shadow-cyan-700/25">
              <Icon name={t.icon} className="h-5 w-5" />
            </span>
            <span className="text-[12px] font-semibold text-slate-500">{t.label}</span>
            <span className="text-lg font-extrabold text-slate-900">{t.value}</span>
          </div>
        ))}
      </div>

      {/* ── Reklama banneri ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-cyan-700 via-cyan-600 to-cyan-400 p-5 text-white shadow-lg shadow-cyan-700/25">
        <div className="max-w-[62%]">
          <div className="text-xl font-extrabold leading-snug">Deutsch meistern mit Spaß! ✨</div>
          <p className="mt-1 text-[13px] leading-relaxed text-white/85">Interaktive Übungen, Videos und spannende Inhalte.</p>
          <Link href={kurseHref} className="mt-3 inline-block rounded-xl bg-white px-4 py-2 text-sm font-bold text-cyan-700 shadow">
            Jetzt entdecken
          </Link>
        </div>
        <div className="pointer-events-none absolute -right-2 top-1/2 -translate-y-1/2 text-[64px] leading-none">🇩🇪</div>
        <div className="pointer-events-none absolute bottom-3 right-16 text-3xl opacity-80">🏛️</div>
      </div>

      {/* ── Videos & Podcasts ── */}
      <div className={`${card} relative overflow-hidden p-5`}>
        <div className="max-w-[62%]">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Videos &amp; Podcasts</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">Lerne Deutsch mit spannenden Inhalten</p>
          <Link href={kurseHref} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-bold text-white shadow-md shadow-cyan-700/25">
            Entdecken <Icon name="arrow" className="h-4 w-4" />
          </Link>
        </div>
        <div className="pointer-events-none absolute -right-1 top-1/2 -translate-y-1/2 text-[58px] leading-none">🎧</div>
        <div className="pointer-events-none absolute bottom-2 right-20 text-3xl">📱</div>
      </div>
    </div>
  );
}
