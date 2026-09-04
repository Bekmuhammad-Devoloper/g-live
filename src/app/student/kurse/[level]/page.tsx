import Link from "next/link";
import { S, type StudentStrings } from "../../_i18n";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import MissingStudent from "../../MissingStudent";
import { getActiveLevels, levelTitle } from "@/lib/studyLevels";
import HeaderBadges from "../../HeaderBadges";
import { NAVY, TEAL } from "../../_ui";

// Daraja ichi — "neyron yo'li". Darslar miya tugunlari bo'lib zigzag
// joylashadi, orasi akson bilan bog'lanadi: o'tilgan qismi to'q va uzluksiz,
// kelgusi qismi och va uzuq.
//
// Nega miya: ilovada allaqachon "Gehirn / ikkinchi miya" (bilim grafi)
// tushunchasi bor. Dars yo'li ham neyron yo'llari ko'rinishida bo'lsa — bu
// bezak emas, mahsulot tilining davomi bo'ladi.
//
// Uch holat BIR QARASHDA farqlanishi kerak, shu sabab rang bilan ham,
// qo'shimcha belgi bilan ham ajratilgan:
//   o'tilgan  — OLTIN miya + belgi   (ilovada oltin = mukofot)
//   joriy     — FERUZA miya + halqa
//   navbatda  — och kontur (hali "yonmagan")

const UNITS_PER_CHAPTER = 3; // Unit 1.1 · 1.2 · 1.3 → keyin 2.1 ...

type NodeState = "done" | "current" | "upcoming";

/* ─────────────── Miya tuguni ─────────────── */

// Shakl ataylab sodda: telefonda 88px da ham ikki yarim shar va burmalar
// o'qiladi. Murakkabroq kontur bu o'lchamda loyqa dog'ga aylanadi.
const BRAIN_OUTER =
  "M62 8C48 3 33 7 26 18 14 21 8 34 13 45 4 53 5 68 15 74c1 11 12 18 23 15 6 7 17 9 25 3 9 6 21 3 26-5 12 1 22-9 21-21 8-8 7-22-3-28 2-13-8-24-21-24-5-5-15-9-24-6Z";

const BRAIN_FOLDS = [
  "M61 9c-2 20 2 38-1 78",
  "M42 22c-8 6-5 15 3 19-9 4-10 15-2 20",
  "M80 22c8 6 5 15-3 19 9 4 10 15 2 20",
  "M32 36c6 3 7 10 3 14",
  "M90 36c-6 3-7 10-3 14",
];

interface BrainProps {
  state: NodeState;
  size?: number;
  /** Gradient id lari sahifada takrorlanmasligi uchun */
  id: string;
}

function Brain({ state, size = 88, id }: BrainProps) {
  const fill =
    state === "done" ? `url(#brainGold-${id})` : state === "current" ? `url(#brainTeal-${id})` : "rgba(255,255,255,0.62)";
  const edge = state === "upcoming" ? "#9db9c6" : "rgba(255,255,255,0.9)";
  const fold = state === "upcoming" ? "#9db9c6" : "rgba(255,255,255,0.8)";

  // viewBox shaklning O'Z chegarasiga toraytirilgan (o'lchangan: 5 4 112 93).
  // Aks holda kvadrat quticha ichida miya yuqoriroqda turib, atrofidagi
  // halqa va belgi pastga siljib qolardi.
  return (
    <svg width={size} height={Math.round((size * 93) / 112)} viewBox="5 4 112 93" aria-hidden>
      <defs>
        <linearGradient id={`brainGold-${id}`} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#ffdc7a" />
          <stop offset="55%" stopColor="#fbc63f" />
          <stop offset="100%" stopColor="#e09217" />
        </linearGradient>
        <linearGradient id={`brainTeal-${id}`} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#2fb9dc" />
          <stop offset="60%" stopColor={TEAL} />
          <stop offset="100%" stopColor={NAVY} />
        </linearGradient>
      </defs>
      <path d={BRAIN_OUTER} fill={fill} stroke={edge} strokeWidth="2.4" strokeLinejoin="round" />
      {BRAIN_FOLDS.map((d) => (
        <path key={d} d={d} fill="none" stroke={fold} strokeWidth="2.2" strokeLinecap="round" />
      ))}
    </svg>
  );
}

function DoneBadge() {
  return (
    <span
      className="absolute -right-1 -top-1 grid h-[26px] w-[26px] place-items-center rounded-full ring-[2.5px] ring-white"
      style={{ background: TEAL }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}

/* ─────────────── Tugunlar orasidagi akson ─────────────── */

// Ustun markazlari 23% va 77% — viewBox 300 da 69 va 231. Tugun kengligi
// (w-[46%]) shu qiymatlarga moslangan, ikkalasi birga o'zgaradi.
function Axon({ toRight, lit }: { toRight: boolean; lit: boolean }) {
  const from = toRight ? 69 : 231;
  const to = toRight ? 231 : 69;
  return (
    <svg viewBox="0 0 300 56" preserveAspectRatio="none" className="h-[56px] w-full" aria-hidden>
      <path
        d={`M${from} 0 C${from} 30, ${to} 26, ${to} 56`}
        fill="none"
        stroke={lit ? TEAL : "#a9c4d1"}
        strokeOpacity={lit ? 0.85 : 0.7}
        strokeWidth={lit ? 4 : 3}
        strokeLinecap="round"
        strokeDasharray={lit ? undefined : "7 10"}
      />
      {/* sinaps — signal shu nuqtadan o'tadi */}
      {lit ? <circle cx={(from + to) / 2} cy="28" r="5" fill={TEAL} opacity="0.9" /> : null}
    </svg>
  );
}

/* ─────────────── Yo'l yakuni ─────────────── */

// Ilgari oxirgi kafeldan keyin ekranning ~70% i bo'sh qolib, sahifa
// tugallanmagandek ko'rinardi. Endi yo'l ataylab yakunlanadi.
function FinishCap({ allDone, t }: { allDone: boolean; t: StudentStrings }) {
  return (
    <div className="flex flex-col items-center pt-1">
      <svg width="4" height="34" viewBox="0 0 4 34" aria-hidden>
        <path
          d="M2 0v34"
          stroke={allDone ? TEAL : "#a9c4d1"}
          strokeOpacity="0.7"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={allDone ? undefined : "7 9"}
        />
      </svg>
      <div className="gl-glass mt-1 flex w-full max-w-[300px] flex-col items-center gap-1.5 rounded-[22px] px-5 py-5 text-center">
        <span
          className="grid h-[52px] w-[52px] place-items-center rounded-full"
          style={{ background: allDone ? "linear-gradient(135deg,#ffdc7a,#e09217)" : "rgba(255,255,255,0.6)" }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={allDone ? "#fff" : "#9db9c6"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
            <path d="M7 6H4.5v1.5A3.5 3.5 0 0 0 8 11M17 6h2.5v1.5A3.5 3.5 0 0 1 16 11" />
            <path d="M12 14v3.5M9 21h6M10 17.5h4" />
          </svg>
        </span>
        <div className="text-[15px] font-extrabold text-slate-900">{allDone ? t.levelFinished : t.levelFinish}</div>
        {!allDone && <p className="text-[12.5px] leading-snug text-slate-600">{t.levelFinishHint}</p>}
      </div>
    </div>
  );
}

/* ─────────────── Fon: neyron to'ri ─────────────── */

// Bulut va yulduzchalar o'rniga. Ular qattiq koordinatalarda (top-[420px])
// turgani uchun 2 ta darsli sahifada bo'sh joyda osilib qolardi; bu qatlam
// esa yo'l bilan birga cho'ziladi.
const MESH_NODES: ReadonlyArray<readonly [number, number]> = [
  [20, 60], [90, 180], [150, 290], [280, 100], [215, 220],
  [155, 330], [35, 380], [110, 485], [270, 420], [200, 525],
];

function NeuralMesh() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.45]"
      preserveAspectRatio="none"
      viewBox="0 0 300 600"
    >
      <g stroke="#8fb6c8" strokeOpacity="0.5" strokeWidth="1" fill="none">
        <path d="M20 60 C70 90, 40 150, 90 180 C130 205, 100 260, 150 290" />
        <path d="M280 100 C230 130, 265 190, 215 220 C175 245, 205 300, 155 330" />
        <path d="M35 380 C85 405, 60 460, 110 485" />
        <path d="M270 420 C225 445, 250 500, 200 525" />
      </g>
      <g fill="#8fb6c8" fillOpacity="0.45">
        {MESH_NODES.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" />
        ))}
      </g>
    </svg>
  );
}

function IcoBack({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

/* ─────────────── Sahifa ─────────────── */

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

  const doneCount = lessons.filter((l) => taught.has(l.id)).length;
  // Joriy dars — o'tilmaganlarning birinchisi (hammasi o'tilgan bo'lsa -1)
  const currentIdx = lessons.findIndex((l) => !taught.has(l.id));
  const pct = lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0;
  const allDone = lessons.length > 0 && doneCount === lessons.length;

  return (
    <div>
      {/* ── Yuqori qator ── */}
      <div className="flex items-center gap-2.5 pt-1">
        <Link href="/student/kurse" aria-label={t.back} className="gl-glass grid h-11 w-11 shrink-0 place-items-center rounded-full">
          <IcoBack />
        </Link>
        <div className="min-w-0 flex-1">
          {/* Sarlavha urg'usi darajaning O'Z rangidan olinadi. Ilgari bu yerda
              binafsha qattiq yozilgandi: daraja rangi feruza bo'lsa ham
              sarlavha binafsha chiqib, tizimdan chetda turardi. */}
          <h1 className="truncate text-[18px] font-extrabold leading-tight tracking-tight text-slate-900">
            {levelTitle(lvl, session.locale)} <span style={{ color: lvl.color }}>{lvl.code}</span>
          </h1>
          {lessons.length > 0 && (
            <div className="text-[12px] font-semibold text-slate-600">
              {doneCount} / {lessons.length} {t.pathProgress}
            </div>
          )}
        </div>
        <HeaderBadges />
      </div>

      {/* ── Daraja jarayoni ── */}
      {lessons.length > 0 && (
        <div className="mt-3 flex items-center gap-2.5">
          <div className="h-[8px] flex-1 overflow-hidden rounded-full bg-white/55 shadow-[inset_0_1px_2px_rgba(19,78,94,0.12)]">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, #fbc63f, ${TEAL})` }} />
          </div>
          <span className="text-[13px] font-extrabold" style={{ color: NAVY }}>
            {pct}%
          </span>
        </div>
      )}

      {/* ── Darslar yo'li ── */}
      {lessons.length === 0 ? (
        <div className="gl-glass mt-8 rounded-[26px] px-5 py-12 text-center">
          <div className="text-[15px] font-semibold text-slate-700">{t.noLessons}</div>
          <p className="mt-1 text-[13px] text-slate-600">{t.teacherAdds}</p>
        </div>
      ) : (
        <div className="relative mt-6 pb-4">
          <NeuralMesh />

          <div className="relative">
            {lessons.map((lesson, i) => {
              const right = i % 2 === 1;
              const chapter = Math.floor(i / UNITS_PER_CHAPTER) + 1;
              const inChapter = (i % UNITS_PER_CHAPTER) + 1;
              const state: NodeState = taught.has(lesson.id) ? "done" : i === currentIdx ? "current" : "upcoming";
              // Akson "yonadi", agar u olib boradigan tugunga yetib borilgan bo'lsa
              const lit = state !== "upcoming";

              return (
                <div key={lesson.id}>
                  {i > 0 && <Axon toRight={right} lit={lit} />}
                  <div className={`flex ${right ? "justify-end" : "justify-start"}`}>
                    <Link
                      href={`/student/kurse/${code}/${lesson.id}`}
                      className="flex w-[46%] flex-col items-center transition active:scale-[0.96]"
                    >
                      <span className="relative block">
                        {/* Halqa miyaning haqiqiy markaziga qo'yiladi: shakl
                            kvadrat emas (112×93), shuning uchun `inset` bilan
                            emas, markazlashtirib chiziladi. */}
                        {state === "current" && (
                          <span
                            className="absolute left-1/2 top-1/2 h-[104px] w-[104px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                            style={{ border: `2.5px solid ${TEAL}`, opacity: 0.3 }}
                          />
                        )}
                        <Brain state={state} id={lesson.id.slice(-6)} />
                        {state === "done" && <DoneBadge />}
                      </span>

                      <span className="mt-1.5 text-[15px] font-extrabold leading-none text-slate-900">
                        Unit {chapter}.{inChapter}
                      </span>

                      {/* Dars nomi ilgari faqat `title` atributida edi — telefonda
                          hover bo'lmagani uchun u umuman ko'rinmasdi. */}
                      <span className="mt-1 line-clamp-2 text-center text-[11.5px] font-medium leading-tight text-slate-600">
                        {lesson.title}
                      </span>

                      <span
                        className="mt-1 rounded-full px-2 py-[2px] text-[10px] font-bold uppercase tracking-[0.04em]"
                        style={
                          state === "done"
                            ? { background: "rgba(224,146,23,0.16)", color: "#9a5f14" }
                            : state === "current"
                              ? { background: "rgba(14,116,144,0.14)", color: NAVY }
                              : { background: "rgba(148,163,184,0.16)", color: "#475569" }
                        }
                      >
                        {state === "done" ? t.pathDone : state === "current" ? t.pathCurrent : t.pathUpcoming}
                      </span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <FinishCap allDone={allDone} t={t} />
        </div>
      )}
    </div>
  );
}
