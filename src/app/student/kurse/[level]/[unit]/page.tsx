import Link from "next/link";
import MissingStudent from "../../../MissingStudent";
import HeaderBadges from "../../../HeaderBadges";
import { NAVY, TEAL } from "../../../_ui";
import { loadUnit } from "./_load";
import { looksLikeVocabulary, parseLessonWords } from "@/lib/lessonWords";
import { prisma } from "@/lib/db";
import { IcoBack, IcoChevron, IcoClipboard, IcoPlayCircle, IcoWords, safeUrl } from "./_parts";

// Dars ichi — FAQAT uchta kirish kartasi: Lug'at · Dars · Uy vazifasi.
//
// Ilgari bu sahifa bitta uzun skroll edi: video, tavsif, topshiriq, uy
// vazifasi va topshirish bloki ketma-ket turardi. O'quvchi kerakli joyni
// topish uchun butun sahifani aylantirar edi.
//
// Endi har bo'lim O'Z MARSHRUTIDA (./lugat, ./dars, ./vazifa). Bu tab'dan
// afzal: har bo'limga to'g'ridan-to'g'ri havola beriladi, telefonning
// "orqaga" tugmasi to'g'ri ishlaydi va har bo'limni alohida rivojlantirsa
// bo'ladi — bittasini o'zgartirish qolganiga tegmaydi.

interface SectionCardProps {
  href: string;
  icon: React.ReactNode;
  accent: string;
  title: string;
  subtitle: string;
  /** O'ng tomondagi qiymat — so'z soni, holat yoki vazifa soni */
  meta: string;
  /** Qiymat bo'sh bo'lsa yorliq so'niq ko'rinadi */
  muted?: boolean;
}

function SectionCard({ href, icon, accent, title, subtitle, meta, muted }: SectionCardProps) {
  return (
    <Link
      href={href}
      className="gl-glass flex items-center gap-3.5 rounded-[24px] px-4 py-4 transition active:scale-[0.985]"
    >
      <span
        className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-[18px] text-white shadow-[0_10px_20px_-8px_rgba(15,60,80,0.65)]"
        style={{ background: accent }}
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[17px] font-extrabold leading-tight tracking-[-0.015em] text-slate-900">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] font-medium leading-snug text-slate-600">
          {subtitle}
        </span>
      </span>

      <span
        className="shrink-0 rounded-full px-3 py-[6px] text-[13px] font-extrabold"
        style={
          muted
            ? { background: "rgba(148,163,184,0.16)", color: "#475569" }
            : { background: "rgba(14,116,144,0.12)", color: NAVY }
        }
      >
        {meta}
      </span>
      <IcoChevron s={17} />
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

  // Uchta bo'lim uchun qisqa hisob — kartadagi o'ng tomondagi qiymat
  const words = parseLessonWords(lesson.topic);
  const hasVocab = words.length > 0 && looksLikeVocabulary(words);

  const hasVideo = !!safeUrl(lesson.videoUrl);
  const hasAssignment = !!(lesson.assignment || safeUrl(lesson.assignmentFileUrl));
  const hasHomework = !!(lesson.homework || safeUrl(lesson.homeworkFileUrl));

  const [view, taskCount] = await Promise.all([
    prisma.lessonView.findFirst({
      where: { studentId: ctx.studentId, courseLessonId: lesson.id },
      select: { id: true },
    }),
    prisma.assignment.count({ where: { courseLessonId: lesson.id, groupId: ctx.groupId } }),
  ]);

  const homeworkCount = taskCount + (hasHomework ? 1 : 0);
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

      {/* Dars raqami va o'tilgan holati — sahifada boshqa hech narsa yo'q,
          shu sabab bu bitta qator kontekstni beradi. */}
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-full bg-white/60 px-3 py-[5px] text-[11.5px] font-bold text-slate-700">
          {t.lesson} {position + 1}/{Math.max(totalInLevel, 1)}
        </span>
        {taught && (
          <span className="flex items-center gap-1 rounded-full px-3 py-[5px] text-[11.5px] font-bold" style={{ background: "rgba(224,146,23,0.16)", color: "#9a5f14" }}>
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
          title={t.vocabulary}
          subtitle={t.lessonWordsSub}
          meta={hasVocab ? `${words.length}` : "—"}
          muted={!hasVocab}
        />

        <SectionCard
          href={`${base}/dars`}
          icon={<IcoPlayCircle s={26} />}
          accent="linear-gradient(150deg, #2fb9dc 0%, #0e7490 100%)"
          title={t.lesson}
          subtitle={t.lessonVideoSub}
          meta={view ? t.watched : hasVideo || hasAssignment ? t.openVideo : "—"}
          muted={!hasVideo && !hasAssignment}
        />

        <SectionCard
          href={`${base}/vazifa`}
          icon={<IcoClipboard s={26} />}
          accent="linear-gradient(150deg, #b07bff 0%, #7c3aed 100%)"
          title={t.homeworkTask}
          subtitle={t.lessonHomeworkSub}
          meta={homeworkCount > 0 ? `${homeworkCount}` : "—"}
          muted={homeworkCount === 0}
        />
      </div>
    </div>
  );
}
