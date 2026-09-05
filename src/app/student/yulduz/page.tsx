import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { starBalance } from "@/lib/coins";
import { getActiveStarRanks, progressOf, rankName } from "@/lib/starRanks";
import { S, type StudentStrings } from "../_i18n";
import { CARD, PageHeader, TEAL } from "../_ui";
import MissingStudent from "../MissingStudent";

// Yulduzni qanday yig'ish mumkin. Tanga uchun bunday sahifa Market ichida
// bor edi, yulduz uchun esa hech qayerda yozilmagandi — o'quvchi raqamni
// ko'rardi-yu, uni qanday ko'paytirishni bilmasdi.
//
// Qoidalar Sozlamalar > Ball va mukofotlar dan olinadi: bu yerda hech
// qanday raqam qattiq yozilmagan.

const RULE_LABEL = (t: StudentStrings, k: string) =>
  k === "lesson" ? t.ruleLesson
  : k === "lessonView" ? t.ruleLessonView
  : k === "homework" ? t.ruleHomework
  : k === "perfect" ? t.rulePerfect
  : k === "gameWin" ? t.ruleGameWin
  : k === "streak7" ? t.ruleStreak
  : t.ruleLevelUp;

const RULE_HINT = (t: StudentStrings, k: string) =>
  k === "lesson" ? t.hintLesson
  : k === "lessonView" ? t.hintLessonView
  : k === "homework" ? t.hintHomework
  : k === "perfect" ? t.hintPerfect
  : k === "gameWin" ? t.hintGameWin
  : k === "streak7" ? t.hintStreak
  : t.hintLevelUp;

function IcoStar({ s = 16 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3.1l2.75 5.57 6.15.9-4.45 4.34 1.05 6.12L12 17.14l-5.5 2.89 1.05-6.12L3.1 9.57l6.15-.9L12 3.1Z" />
    </svg>
  );
}

export default async function StudentStarsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const t = S(session.locale);

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!student) return <MissingStudent />;

  const [purse, ranks] = await Promise.all([starBalance(student.id), getActiveStarRanks()]);
  const stars = purse.earned;
  const step = progressOf(ranks, stars);

  // Qiymati 0 bo'lgan qoida yulduz bermaydi — uni ko'rsatish chalg'itadi.
  // Yig'ilgani tepada tursin: o'quvchiga o'zi bajargani qiziqroq.
  const rules = purse.lines
    .filter((l) => (l.per ?? 0) > 0)
    .sort((a, b) => (b.count > 0 ? 1 : 0) - (a.count > 0 ? 1 : 0) || b.total - a.total);

  return (
    <div className="space-y-4">
      <PageHeader title={t.stars} subtitle={t.starRule} backLabel={t.back} back="/student" />

      {/* ── Hisob ── */}
      <div
        className="relative overflow-hidden rounded-[26px] p-5 text-white shadow-[0_16px_34px_-18px_rgba(14,116,144,0.9)]"
        style={{ background: `linear-gradient(135deg, #17a2bf, ${TEAL})` }}
      >
        <span className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex items-center gap-3.5">
          <span className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-2xl bg-white/20 text-[#ffe27a] backdrop-blur-sm">
            <IcoStar s={32} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">{t.earned}</div>
            <div className="text-[30px] font-extrabold leading-tight tabular-nums">{stars}</div>
            <div className="text-[12.5px] text-white/75">{t.stars}</div>
          </div>
        </div>

        {/* Yulduz nima uchun kerak — daraja sahifasiga ko'prik */}
        {step.current && (
          <Link
            href="/student/daraja"
            className="relative mt-4 flex items-center gap-2.5 rounded-2xl bg-white/15 px-3.5 py-2.5 backdrop-blur-sm transition active:scale-[0.98]"
          >
            {step.current.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={step.current.iconUrl} alt="" className="h-8 w-8 shrink-0 object-contain" />
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-white/65">{t.starRank}</span>
              <span className="block truncate text-[14.5px] font-extrabold">{rankName(step.current, session.locale)}</span>
              {step.next && (
                <span className="block truncate text-[11.5px] text-white/75">
                  {rankName(step.next, session.locale)} — {step.need} {t.starsToNext}
                </span>
              )}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </Link>
        )}
      </div>

      {/* ── Qoidalar ── */}
      <div className="px-1 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: TEAL }}>
        {t.starRule}
      </div>

      <div className={CARD + " overflow-hidden rounded-[26px]"}>
        {rules.map((l, i) => (
          <div key={l.key} className={"flex items-center gap-3 px-4 py-3 " + (i > 0 ? "border-t border-slate-900/[0.05]" : "")}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-bold text-slate-900">{RULE_LABEL(t, l.key)}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">{RULE_HINT(t, l.key)}</span>
              {l.count > 0 && (
                <span className="mt-1 block text-[11.5px] font-semibold text-slate-400">
                  {l.count} {t.timesEarned} · {l.total} <span className="text-amber-500">★</span>
                </span>
              )}
            </span>
            <span
              className="flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1.5 text-[15px] font-extrabold tabular-nums text-white"
              style={{ background: TEAL }}
            >
              +{l.per}
              <IcoStar s={13} />
            </span>
          </div>
        ))}
      </div>

      <p className="px-2 text-center text-[12.5px] leading-relaxed text-slate-500">{t.starsNeverSpent}</p>

      <Link
        href="/student/daraja"
        className="flex h-12 items-center justify-center gap-1.5 rounded-2xl text-[14.5px] font-bold text-white shadow-[0_8px_16px_rgba(14,116,144,0.3)]"
        style={{ background: TEAL }}
      >
        {t.seeRanks}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </Link>
    </div>
  );
}
