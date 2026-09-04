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
// joylashadi, orasi akson bilan bog'lanadi.
//
// TUGUN HOLATI RANG BILAN EMAS, TO'LISH BILAN ko'rsatiladi: miya boshida oq,
// dars bajarilgani sari feruza suv kabi ko'tariladi. Shu sabab "o'tildi /
// o'tilmadi" ikkiligi o'rniga haqiqiy jarayon ko'rinadi.

const UNITS_PER_CHAPTER = 3; // Unit 1.1 · 1.2 · 1.3 → keyin 2.1 ...

/* ─────────────── Bo'sh holat ranglari ─────────────── */

// Hali hech dars o'tilmagan guruhda BUTUN yo'l shu ranglarda turadi, ya'ni
// bu eng ko'p ko'rinadigan holat. Ambientning eng och nuqtasi o'lchangan:
// rgb(253,254,254). Eski qiymatlar unda 1.4–2.0:1 kontrast berardi
// (WCAG 1.4.11 chegarasi 3.0) — yo'l ko'zga deyarli ilinmasdi. Alpha
// oshirish yordam bermaydi, rangning TUSI o'zgarishi kerak edi.
const EMPTY_BODY = "#eaf2f6";
const EMPTY_EDGE = "#5c8496"; // o'lchangan 4.00:1
const EMPTY_FOLD = "#7391a4"; // o'lchangan 3.29:1
const EMPTY_LINE = "#6d93a3"; // o'lchangan 3.27:1

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

// Shaklning O'LCHANGAN vertikal chegarasi — suv sathi shu oraliqda yuradi
const BRAIN_TOP = 4.5;
const BRAIN_BOTTOM = 96.8;
const BRAIN_SPAN = BRAIN_BOTTOM - BRAIN_TOP;

const waterY = (pct: number) => BRAIN_BOTTOM - (BRAIN_SPAN * Math.max(0, Math.min(100, pct))) / 100;
const WAVE = 3.2; // to'lqin balandligi

/** Suv yuzasi — yengil to'lqin, so'ng pastga to'ldiriladi */
function waterPath(pct: number): string {
  const y = waterY(pct);
  return `M0 ${y} C20 ${y - WAVE}, 40 ${y + WAVE}, 60 ${y} C80 ${y - WAVE}, 100 ${y + WAVE}, 120 ${y} L120 110 L0 110 Z`;
}

/** Faqat yuza chizig'i — ustiga yorqin aks chiziladi (suv "ho'l" ko'rinadi) */
function surfacePath(pct: number): string {
  const y = waterY(pct);
  return `M0 ${y} C20 ${y - WAVE}, 40 ${y + WAVE}, 60 ${y} C80 ${y - WAVE}, 100 ${y + WAVE}, 120 ${y}`;
}

// Shaklning o'lchangan markazi — halqa va foiz shunga nisbatan qo'yiladi
const BRAIN_CX = 61.15;
const BRAIN_CY = 50.65;

interface BrainProps {
  /** 0..100 — miya shu foizgacha to'ladi */
  pct: number;
  size?: number;
  /** clipPath id lari sahifada takrorlanmasligi uchun — DARS TARTIBI ishlatiladi
      (id ning oxirgi belgilari emas: ular tasodifan bir xil chiqishi mumkin) */
  id: string;
  /** Joriy dars — atrofida halqa chiziladi */
  current?: boolean;
}

// Uch qatlam: bo'sh asos → suv (miya shakli bilan kesilgan, ustida oq
// burmalar) → kontur. Suv chegarasidan yuqorisi va pastgisi shu sabab
// avtomatik to'g'ri rangda chiqadi — hech qayerda qo'lda bo'yash yo'q,
// ya'ni istalgan foizda to'g'ri ko'rinadi.
//
// viewBox shaklning o'z chegarasiga toraytirilgan (5 4 112 93): aks holda
// kvadrat quticha ichida miya yuqorida turib, atrofidagi halqa siljirdi.
function Brain({ pct, size = 88, id, current = false }: BrainProps) {
  const filled = pct > 0;
  const water = waterPath(pct);

  // Foiz miyaning ICHIDA turadi. Suv sathi matndan yuqori ko'tarilganda matn
  // suv ostida qoladi — o'shanda oq, aks holda to'q. Kontur qarama-qarshi
  // rangda: matn burma chiziqlari ustida ham aniq ajralib turadi.
  const submerged = waterY(pct) < BRAIN_CY;
  const textFill = submerged ? "#ffffff" : NAVY;
  const textEdge = submerged ? "rgba(10,95,120,0.55)" : "rgba(255,255,255,0.9)";

  return (
    <svg width={size} height={Math.round((size * 93) / 112)} viewBox="5 4 112 93" aria-hidden overflow="visible">
      <defs>
        <clipPath id={`brainClip-${id}`}>
          <path d={BRAIN_OUTER} />
        </clipPath>
        <clipPath id={`waterClip-${id}`}>
          <path d={water} />
        </clipPath>
        {/* Chuqurlik: chetlari to'qroq — shakl yassi qog'oz emas, hajmli */}
        <radialGradient id={`brainDepth-${id}`} cx="0.5" cy="0.35" r="0.75">
          <stop offset="55%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#0a3b4c" stopOpacity="0.22" />
        </radialGradient>
        {/* Yerdagi soya — tugun fonda "suzib" turadi */}
        <filter id={`brainShadow-${id}`} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#0a3b4c" floodOpacity="0.26" />
        </filter>
      </defs>

      {/* Joriy dars halqasi — DOIRA emas, miya shaklining o'zi 1.15 barobar
          kattalashtirilgani. Doira miyaning kengligiga to'g'ri kelmasdi va
          shaklning chetlari halqadan chiqib qolardi. */}
      {current && (
        <path
          d={BRAIN_OUTER}
          fill="none"
          stroke={TEAL}
          strokeOpacity="0.32"
          strokeWidth="2.2"
          strokeLinejoin="round"
          transform={`translate(${BRAIN_CX} ${BRAIN_CY}) scale(1.15) translate(${-BRAIN_CX} ${-BRAIN_CY})`}
        />
      )}

      <g filter={`url(#brainShadow-${id})`}>
        {/* bo'sh miya */}
        <path d={BRAIN_OUTER} fill={EMPTY_BODY} />
        {BRAIN_FOLDS.map((d) => (
          <path key={d} d={d} fill="none" stroke={EMPTY_FOLD} strokeWidth="2.2" strokeLinecap="round" />
        ))}

        {/* suv */}
        {filled && (
          <g clipPath={`url(#brainClip-${id})`}>
            <path d={water} fill="url(#glWater)" />
            <g clipPath={`url(#waterClip-${id})`}>
              {BRAIN_FOLDS.map((d) => (
                <path key={d} d={d} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2.2" strokeLinecap="round" />
              ))}
            </g>
            {/* suv yuzasidagi yorqin aks — "ho'l" ko'rinish shundan */}
            <path d={surfacePath(pct)} fill="none" stroke="#dffaff" strokeOpacity="0.95" strokeWidth="2" />
          </g>
        )}

        {/* chuqurlik qatlami */}
        <path d={BRAIN_OUTER} fill={`url(#brainDepth-${id})`} clipPath={`url(#brainClip-${id})`} />

        {/* kontur: suv ustida to'q, suv ostida oq */}
        <path d={BRAIN_OUTER} fill="none" stroke={EMPTY_EDGE} strokeWidth="2.4" strokeLinejoin="round" />
        {filled && (
          <g clipPath={`url(#waterClip-${id})`}>
            <path d={BRAIN_OUTER} fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="2.4" strokeLinejoin="round" />
          </g>
        )}

        {/* tepa-chapdagi yaltiroq — shisha/ho'l sirt hissi */}
        <ellipse
          cx="42" cy="26" rx="24" ry="14"
          fill="url(#glGloss)"
          transform="rotate(-22 42 26)"
          clipPath={`url(#brainClip-${id})`}
        />

        {/* Foiz — miyaning ICHIDA. Ilgari pastida alohida yorliq bo'lib,
            tugundan ajralib turardi va qatorni uzaytirardi. */}
        <text
          x={BRAIN_CX}
          y={BRAIN_CY}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="var(--font-sans)"
          fontSize="25"
          fontWeight="800"
          fill={textFill}
          stroke={textEdge}
          strokeWidth="4"
          paintOrder="stroke"
          strokeLinejoin="round"
        >
          {pct}%
        </text>
      </g>
    </svg>
  );
}

// Suv gradienti sahifada BIR marta e'lon qilinadi: 12 ta dars bo'lsa ham
// brauzer bitta bo'yoq manbasini yaratadi. `display:none` ATAYLAB
// ishlatilmaydi — eski WebView'da yashirilgan element ichidagi gradientga
// havola uzilib qolishi mumkin.
function BrainDefs() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute h-0 w-0 overflow-hidden">
      <defs>
        {/* Suv: uch pog'ona — yuzasi yorqin, tubi to'q */}
        <linearGradient id="glWater" x1="0.1" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#5fd8ee" />
          <stop offset="45%" stopColor="#22a8c8" />
          <stop offset="100%" stopColor="#0a5f78" />
        </linearGradient>
        {/* Yaltiroq har tugunda bir xil — bir marta e'lon qilinadi */}
        <linearGradient id="glGloss" x1="0.15" y1="0" x2="0.6" y2="0.75">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
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
        stroke={lit ? TEAL : EMPTY_LINE}
        strokeOpacity={lit ? 0.8 : 1}
        strokeWidth={lit ? 4 : 3}
        strokeLinecap="round"
        strokeDasharray={lit ? undefined : "7 10"}
      />
      {lit ? <circle cx={(from + to) / 2} cy="28" r="5" fill={TEAL} opacity="0.85" /> : null}
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
          stroke={allDone ? TEAL : EMPTY_LINE}
          strokeOpacity="0.9"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={allDone ? undefined : "7 9"}
        />
      </svg>
      <div className="gl-glass mt-1 flex w-full max-w-[300px] flex-col items-center gap-1.5 rounded-[22px] px-5 py-5 text-center">
        <span
          className="grid h-[52px] w-[52px] place-items-center rounded-full"
          style={{ background: allDone ? `linear-gradient(135deg,#3fc9e4,${TEAL})` : "rgba(255,255,255,0.6)" }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={allDone ? "#fff" : EMPTY_EDGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
// turgani uchun kam darsli sahifada bo'sh joyda osilib qolardi.
//
// Shaffofligi ATAYLAB past: to'r kontent emas, havo. Sezilib qolsa
// minimalizm buziladi va miyalar bilan kesishib, sahifa iflos ko'rinadi.
function NeuralMesh() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18]"
      preserveAspectRatio="none"
      viewBox="0 0 300 600"
    >
      <g stroke="#8fb6c8" strokeWidth="1" fill="none">
        <path d="M14 70 C60 100, 34 158, 78 190" />
        <path d="M286 110 C244 140, 272 196, 232 226" />
        <path d="M22 386 C68 410, 46 462, 92 488" />
        <path d="M278 428 C238 452, 258 504, 214 528" />
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

  const [allLessons, progress, views, assignments] = await Promise.all([
    group
      ? prisma.courseLesson.findMany({
          where: { programId: group.programId },
          orderBy: { order: "asc" },
          select: { id: true, order: true, levelCode: true, title: true, videoUrl: true },
        })
      : Promise.resolve([]),
    group
      ? prisma.groupLessonProgress.findMany({ where: { groupId: group.id, taught: true }, select: { courseLessonId: true } })
      : Promise.resolve([]),
    prisma.lessonView.findMany({ where: { studentId: student.id }, select: { courseLessonId: true } }),
    group
      ? prisma.assignment.findMany({
          where: { groupId: group.id, courseLessonId: { not: null } },
          select: {
            courseLessonId: true,
            submissions: { where: { studentId: student.id }, select: { id: true }, take: 1 },
          },
        })
      : Promise.resolve([]),
  ]);

  const fallback = (group?.levelCode ?? student.currentLevel ?? "A1").slice(0, 2).toUpperCase();
  const lessons = allLessons.filter((l) => (l.levelCode ?? fallback).toUpperCase() === code);

  const taught = new Set(progress.map((p) => p.courseLessonId));
  const watched = new Set(views.map((v) => v.courseLessonId));

  const hasTask = new Set<string>();
  const didTask = new Set<string>();
  for (const a of assignments) {
    if (!a.courseLessonId) continue;
    hasTask.add(a.courseLessonId);
    if (a.submissions.length > 0) didTask.add(a.courseLessonId);
  }

  /**
   * Bitta darsning to'lish foizi.
   *
   * Uchta belgi hisobga olinadi, LEKIN faqat o'sha darsga tegishlilari:
   *   · o'qituvchi darsni o'tdi     (har doim hisoblanadi)
   *   · o'quvchi videoni ko'rdi     (faqat video bo'lsa)
   *   · o'quvchi vazifani topshirdi (faqat vazifa berilgan bo'lsa)
   *
   * Bo'lmagan bosqich maxrajga qo'shilmaydi — aks holda videosi yo'q dars
   * hech qachon to'lmasdi va o'quvchi aybdor bo'lmagan holda "bajarilmagan"
   * bo'lib turaverardi.
   */
  const lessonPct = (l: { id: string; videoUrl: string | null }): number => {
    let total = 1;
    let got = taught.has(l.id) ? 1 : 0;

    if (l.videoUrl) {
      total += 1;
      if (watched.has(l.id)) got += 1;
    }
    if (hasTask.has(l.id)) {
      total += 1;
      if (didTask.has(l.id)) got += 1;
    }
    return Math.round((got / total) * 100);
  };

  const pcts = lessons.map(lessonPct);
  const n = lessons.length;
  const doneCount = lessons.filter((l) => taught.has(l.id)).length;
  const currentIdx = pcts.findIndex((p) => p < 100);
  const levelPct = n ? Math.round(pcts.reduce((a, b) => a + b, 0) / n) : 0;
  const allDone = n > 0 && pcts.every((p) => p >= 100);

  return (
    <div>
      <BrainDefs />

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
          {n > 0 && (
            <div className="text-[12px] font-semibold text-slate-600">
              {doneCount} / {n} {t.pathProgress}
            </div>
          )}
        </div>
        <HeaderBadges />
      </div>

      {/* ── Daraja jarayoni ── */}
      {n > 0 && (
        <div className="mt-3 flex items-center gap-2.5">
          <div className="h-[8px] flex-1 overflow-hidden rounded-full bg-white/55 shadow-[inset_0_1px_2px_rgba(19,78,94,0.12)]">
            <div className="h-full rounded-full" style={{ width: `${levelPct}%`, background: `linear-gradient(90deg, #3fc9e4, ${TEAL})` }} />
          </div>
          <span className="text-[13px] font-extrabold" style={{ color: NAVY }}>
            {levelPct}%
          </span>
        </div>
      )}

      {/* ── Darslar yo'li ── */}
      {n === 0 ? (
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
              const pct = pcts[i];
              const isCurrent = i === currentIdx;

              return (
                <div key={lesson.id}>
                  {i > 0 && <Axon toRight={right} lit={pct > 0 || isCurrent} />}

                  <div className={`flex ${right ? "justify-end" : "justify-start"}`}>
                    <Link
                      href={`/student/kurse/${code}/${lesson.id}`}
                      className="flex w-[46%] flex-col items-center transition active:scale-[0.96]"
                    >
                      <Brain pct={pct} id={String(i)} current={isCurrent} />

                      <span className="mt-1.5 text-[15px] font-extrabold leading-none text-slate-900">
                        Unit {chapter}.{inChapter}
                      </span>

                      {/* Dars nomi ilgari faqat `title` atributida edi — telefonda
                          hover bo'lmagani uchun umuman ko'rinmasdi. */}
                      <span className="mt-1 line-clamp-2 text-center text-[11.5px] font-medium leading-tight text-slate-600">
                        {lesson.title}
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
