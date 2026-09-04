import Link from "next/link";
import { S } from "../../_i18n";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import MissingStudent from "../../MissingStudent";
import { getActiveLevels, levelTitle } from "@/lib/studyLevels";
import HeaderBadges from "../../HeaderBadges";

// Daraja ichi — maketdagi "darslar yo'li": unit kafellari zigzag bo'lib
// joylashadi, orasi uzuq-uzuq chiziq bilan bog'lanadi, orqa fonda bulut va
// yulduzchalar. Kafelga bosilsa — unit ichi (Vocabulary / Video / Exercises).

const UNITS_PER_CHAPTER = 3; // Unit 1.1 · 1.2 · 1.3 → keyin 2.1 ...

function IcoBack({ s = 22 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

// ── Bezaklar: bulut va yulduzcha ──
function Cloud({ w = 62, o = 0.55 }: { w?: number; o?: number }) {
  return (
    <svg width={w} height={w * 0.6} viewBox="0 0 62 37" style={{ opacity: o }}>
      <g fill="#bcd9f7">
        <circle cx="18" cy="22" r="13" />
        <circle cx="33" cy="16" r="16" />
        <circle cx="47" cy="24" r="11" />
        <rect x="14" y="24" width="36" height="11" rx="5.5" />
      </g>
    </svg>
  );
}
function Sparkle({ s = 22, c = "#fbbf24" }: { s?: number; c?: string }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c}>
      <path d="M12 1.5c.9 5.4 3.6 8.1 9 9-5.4.9-8.1 3.6-9 9-.9-5.4-3.6-8.1-9-9 5.4-.9 8.1-3.6 9-9Z" />
    </svg>
  );
}

// ── Ikki kafel orasidagi uzuq chiziq ──
function Connector({ toRight }: { toRight: boolean }) {
  // Chapdan o'ngga yoki o'ngdan chapga silliq S-egri
  const d = toRight ? "M62 0 C62 40, 238 22, 238 62" : "M238 0 C238 40, 62 22, 62 62";
  return (
    <svg viewBox="0 0 300 62" preserveAspectRatio="none" className="h-[62px] w-full">
      <path d={d} fill="none" stroke="#5cb3ec" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="9 11" />
    </svg>
  );
}

export default async function StudentLevelPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  const code = level.toUpperCase();
  const levels = await getActiveLevels();
  const lvl = levels.find((l) => l.code.toUpperCase() === code);
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

  const [allLessons, progress] = await Promise.all([
    group
      ? prisma.courseLesson.findMany({
          where: { programId: group.programId },
          orderBy: { order: "asc" },
          select: { id: true, order: true, levelCode: true, title: true },
        })
      : Promise.resolve([]),
    group
      ? prisma.groupLessonProgress.findMany({ where: { groupId: group.id, taught: true }, select: { courseLessonId: true } })
      : Promise.resolve([]),
  ]);

  const fallback = (group?.levelCode ?? student.currentLevel ?? "A1").slice(0, 2).toUpperCase();
  const lessons = allLessons.filter((l) => (l.levelCode ?? fallback).toUpperCase() === code);
  const taught = new Set(progress.map((p) => p.courseLessonId));

  return (
    <div className="-mx-4 -mt-2 min-h-screen px-4 pb-4 pt-2">
      {/* ── Yuqori qator: orqaga · sarlavha · ballar ── */}
      <div className="flex items-center gap-2">
        <Link href="/student/kurse" className="gl-glass grid h-11 w-11 shrink-0 place-items-center rounded-full">
          <IcoBack s={26} />
        </Link>
        {/* Sarlavha — daraja nomi. Tor ekranda ham sig'ishi uchun kichikroq shrift. */}
        <h1 className="min-w-0 flex-1 truncate text-[17px] font-extrabold tracking-tight text-[#4c1d95]">
          {levelTitle(lvl, session.locale)} <span className="text-[#7c3aed]">{lvl.code}</span>
        </h1>
        <HeaderBadges />
      </div>


      {/* ── Darslar yo'li ── */}
      {lessons.length === 0 ? (
        <div className="gl-glass mt-8 rounded-3xl px-5 py-12 text-center">
          <div className="text-[15px] font-semibold text-slate-700">{t.noLessons}</div>
          <p className="mt-1 text-[13px] text-slate-500">{t.teacherAdds}</p>
        </div>
      ) : (
        <div className="relative mt-5 pb-6">
          {/* orqa fon bezaklari */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute right-8 top-2"><Cloud w={70} /></div>
            <div className="absolute left-[46%] top-[128px]"><Cloud w={48} o={0.5} /></div>
            <div className="absolute right-[42%] top-[420px]"><Cloud w={54} o={0.45} /></div>
            <div className="absolute left-6 top-[196px]"><Sparkle s={22} /></div>
            <div className="absolute left-[52%] top-[236px]"><Sparkle s={30} /></div>
            <div className="absolute right-[30%] top-[330px]"><Sparkle s={20} /></div>
            <div className="absolute left-8 top-[430px]"><Sparkle s={24} /></div>
            <div className="absolute right-10 top-[520px]"><Sparkle s={18} /></div>
          </div>

          <div className="relative">
            {lessons.map((l, i) => {
              const right = i % 2 === 1;
              const chapter = Math.floor(i / UNITS_PER_CHAPTER) + 1;
              const inChapter = (i % UNITS_PER_CHAPTER) + 1;
              const pct = taught.has(l.id) ? 100 : 0;
              return (
                <div key={l.id}>
                  {i > 0 && <Connector toRight={right} />}
                  <div className={`flex ${right ? "justify-end" : "justify-start"}`}>
                    <Link
                      href={`/student/kurse/${code}/${l.id}`}
                      title={l.title}
                      className="relative flex h-[112px] w-[112px] flex-col justify-between rounded-[26px] p-3 shadow-[0_8px_0_#1d4ed8,0_14px_22px_rgba(29,78,216,0.35)] transition active:translate-y-[3px] active:shadow-[0_5px_0_#1d4ed8,0_10px_16px_rgba(29,78,216,0.3)]"
                      style={{ background: "linear-gradient(160deg, #3b8ef0 0%, #2563eb 60%, #1d4ed8 100%)" }}
                    >
                      <span className="text-[19px] font-extrabold leading-none text-white">{pct}%</span>
                      <span className="text-[17px] font-extrabold leading-tight text-white">
                        Unit {chapter}.{inChapter}
                      </span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
