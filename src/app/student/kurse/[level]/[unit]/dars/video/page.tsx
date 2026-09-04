import Link from "next/link";
import { prisma } from "@/lib/db";
import MissingStudent from "../../../../../MissingStudent";
import { loadUnit } from "../../_load";
import { SectionHeader, embedUrl, isUpload, safeUrl, youtubePoster } from "../../_parts";
import Player from "./Player";

// Bitta video sahifasi — muqova, "Ko'rish" tugmasi va "Video mashq".
//
// Muqova ATAYLAB o'zimizniki: YouTube iframe'i faqat "Ko'rish" bosilganda
// yuklanadi. Aks holda sahifa ochilishi bilan YouTube o'z brendi, tavsiyalari
// va bir necha yuz kilobayt skriptini olib kelardi.

const ACCENT = "linear-gradient(150deg, #2fb9dc 0%, #0e7490 100%)";

export default async function LessonVideoPage({
  params,
}: {
  params: Promise<{ level: string; unit: string }>;
}) {
  const { level, unit } = await params;
  const ctx = await loadUnit(level, unit);
  if (ctx.missing) return <MissingStudent />;

  const { t, code, lesson, unitLabel } = ctx;

  const view = await prisma.lessonView.findFirst({
    where: { studentId: ctx.studentId, courseLessonId: lesson.id },
    select: { id: true },
  });

  const video = safeUrl(lesson.videoUrl);
  const embed = video && !isUpload(video) ? embedUrl(video) : null;
  const mode = !video ? "none" : isUpload(video) ? "file" : embed ? "embed" : "link";
  const poster = video && !isUpload(video) ? youtubePoster(video) : null;

  const base = `/student/kurse/${code}/${lesson.id}`;
  const hasExercise = !!(lesson.assignment || safeUrl(lesson.assignmentFileUrl));

  return (
    <div>
      <SectionHeader
        backHref={`${base}/dars`}
        backLabel={t.back}
        title={`1-${t.videoSection.toLowerCase()}`}
        subtitle={`${unitLabel} · ${lesson.title}`}
        accent={ACCENT}
      />

      <div className="mt-4 space-y-3">
        {/* ── Muqova ── */}
        <div className="relative aspect-video w-full overflow-hidden rounded-[24px] shadow-[0_18px_36px_-20px_rgba(9,32,53,0.8)]" style={{ background: ACCENT }}>
          {poster ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-black/25" />
            </>
          ) : (
            <>
              {/* Yuklangan videoda muqova yo'q — o'rniga ilova logotipi.
                  Diagonal chiziqlar tekis rangni "jonlantiradi". */}
              <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.14]" preserveAspectRatio="none" viewBox="0 0 100 56">
                <g stroke="#fff" strokeWidth="6" fill="none">
                  <path d="M-10 66 L40 -10" />
                  <path d="M10 66 L60 -10" />
                  <path d="M30 66 L80 -10" />
                  <path d="M50 66 L100 -10" />
                </g>
              </svg>
              <span className="absolute inset-0 grid place-items-center px-8">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-dark.png" alt="Germaniya Live" className="max-h-[46%] w-auto max-w-[74%] object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)]" />
              </span>
            </>
          )}

          {/* "Ko'rish" — bosilganda to'liq ekran gorizontal pleyer ochiladi */}
          <div className="absolute bottom-3.5 right-3.5">
            <Player
              mode={mode}
              src={mode === "embed" ? embed : video}
              lessonId={lesson.id}
              watched={!!view}
              playLabel={t.watchVideo}
              closeLabel={t.closePlayer}
              rotateHint={t.rotateHint}
            />
          </div>

          {mode === "none" && (
            <span className="absolute inset-x-0 bottom-0 bg-black/45 px-4 py-2.5 text-center text-[12.5px] font-semibold text-white/85">
              {t.noVideoYet}
            </span>
          )}
        </div>

        {/* ── Video mashq ── */}
        <Link
          href={hasExercise ? `${base}/dars/mashq` : `${base}/vazifa`}
          className="flex min-h-[52px] w-full items-center justify-center rounded-[20px] text-[15px] font-extrabold text-white shadow-[0_12px_24px_-12px_rgba(15,60,80,0.8)] transition active:scale-[0.98]"
          style={{ background: ACCENT }}
        >
          {t.videoExercise}
        </Link>
      </div>
    </div>
  );
}
