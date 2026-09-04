import Link from "next/link";
import MissingStudent from "../../../MissingStudent";
import HeaderBadges from "../../../HeaderBadges";
import { NAVY, TEAL } from "../../../_ui";
import { loadUnit } from "./_load";
import { loadUnitProgress } from "./_progress";
import { IcoBack, IcoChevron, IcoClipboard, IcoPlayCircle, IcoWords } from "./_parts";

// Dars ichi — FAQAT uchta kirish kartasi: Lug'at · Dars · Uy vazifasi.
//
// Karta o'zi progress chizig'i: fon bo'lim rangi bilan chapdan o'ngga
// foizgacha to'ladi. Shu sabab o'quvchi bosishdan oldin ham qaysi bo'lim
// qancha bajarilganini ko'radi — alohida progress element kerak emas.
//
// Har bo'lim O'Z MARSHRUTIDA (./lugat, ./dars, ./vazifa): har biriga
// to'g'ridan-to'g'ri havola beriladi, telefonning "orqaga" tugmasi to'g'ri
// ishlaydi va bo'limlarni alohida rivojlantirsa bo'ladi.

interface SectionCardProps {
  href: string;
  icon: React.ReactNode;
  /** To'lish rangi (to'q) */
  accent: string;
  /** To'lish rangi (och) — kartaning to'lmagan qismi */
  soft: string;
  title: string;
  subtitle: string;
  /** 0..100 */
  pct: number;
  /** Bo'lim uchun material bormi — bo'lmasa foiz o'rniga chiziqcha */
  has: boolean;
}

function SectionCard({ href, icon, accent, soft, title, subtitle, pct, has }: SectionCardProps) {
  return (
    <Link
      href={href}
      className="gl-glass relative flex items-center gap-3.5 overflow-hidden rounded-[24px] px-4 py-4 transition active:scale-[0.985]"
    >
      {/* To'lish qatlami — kontentning ORQASIDA, shuning uchun matn har doim
          o'qiladi va foiz o'zgarganda hech narsa siljimaydi. */}
      <span aria-hidden className="absolute inset-y-0 left-0" style={{ width: `${has ? pct : 0}%`, background: soft }} />

      <span
        className="relative grid h-[54px] w-[54px] shrink-0 place-items-center rounded-[18px] text-white shadow-[0_10px_20px_-8px_rgba(15,60,80,0.65)]"
        style={{ background: accent }}
      >
        {icon}
      </span>

      <span className="relative min-w-0 flex-1">
        <span className="block truncate text-[17px] font-extrabold leading-tight tracking-[-0.015em] text-slate-900">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] font-medium leading-snug text-slate-600">
          {subtitle}
        </span>
      </span>

      <span className="relative shrink-0 text-[19px] font-extrabold tabular-nums text-slate-900">
        {has ? `${pct}%` : "—"}
      </span>
      <span className="relative">
        <IcoChevron s={17} />
      </span>
    </Link>
  );
}

export default async function StudentUnitPage({
  params,
}: {
  params: Promise<{ level: string; unit: string }>;
}) {
  const { level, unit } = await params;
  const ctx = await loadUnit(level, unit);
  if (ctx.missing) return <MissingStudent />;

  const { t, code, lesson, unitLabel, position, totalInLevel, taught } = ctx;
  const p = await loadUnitProgress(ctx);

  const base = `/student/kurse/${code}/${lesson.id}`;

  return (
    <div>
      {/* ── Yuqori qator ── */}
      <div className="flex items-center gap-2.5 pt-1">
        <Link
          href={`/student/kurse/${code}`}
          aria-label={t.back}
          className="gl-glass grid h-11 w-11 shrink-0 place-items-center rounded-full"
        >
          <span style={{ color: TEAL }}>
            <IcoBack s={23} />
          </span>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[19px] font-extrabold leading-tight tracking-[-0.02em] text-slate-900">
            {unitLabel}
          </h1>
          <div className="truncate text-[12.5px] font-medium text-slate-600">{lesson.title}</div>
        </div>
        <HeaderBadges />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-full bg-white/60 px-3 py-[5px] text-[11.5px] font-bold text-slate-700">
          {t.lesson} {position + 1}/{Math.max(totalInLevel, 1)}
        </span>
        {taught && (
          <span
            className="flex items-center gap-1 rounded-full px-3 py-[5px] text-[11.5px] font-bold"
            style={{ background: "rgba(14,116,144,0.14)", color: NAVY }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
            {t.pathDone}
          </span>
        )}
      </div>

      {/* ── Uchta bo'lim ── */}
      <div className="mt-4 space-y-3">
        <SectionCard
          href={`${base}/lugat`}
          icon={<IcoWords s={26} />}
          accent="linear-gradient(150deg, #f6c453 0%, #e09217 100%)"
          soft="rgba(246,196,83,0.30)"
          title={t.vocabulary}
          subtitle={p.vocab.has ? `${p.vocab.words} ${t.wordCount}` : t.lessonWordsSub}
          pct={p.vocab.pct}
          has={p.vocab.has}
        />

        <SectionCard
          href={`${base}/dars`}
          icon={<IcoPlayCircle s={26} />}
          accent="linear-gradient(150deg, #2fb9dc 0%, #0e7490 100%)"
          soft="rgba(63,201,228,0.28)"
          title={t.lesson}
          subtitle={t.lessonVideoSub}
          pct={p.lesson.pct}
          has={p.lesson.has}
        />

        <SectionCard
          href={`${base}/vazifa`}
          icon={<IcoClipboard s={26} />}
          accent="linear-gradient(150deg, #b07bff 0%, #7c3aed 100%)"
          soft="rgba(176,123,255,0.26)"
          title={t.homeworkTask}
          subtitle={p.homework.has ? `${p.homework.done}/${p.homework.total}` : t.lessonHomeworkSub}
          pct={p.homework.pct}
          has={p.homework.has}
        />
      </div>
    </div>
  );
}
