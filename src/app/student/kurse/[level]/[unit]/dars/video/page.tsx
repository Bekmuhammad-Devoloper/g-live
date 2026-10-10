import Link from "next/link";
import { prisma } from "@/lib/db";
import MissingStudent from "../../../../../MissingStudent";
import { loadUnit } from "../../_load";
import { SectionHeader, safeUrl } from "../../_parts";
import VideoCover, { VIDEO_ACCENT } from "./Cover";
import { getBrand } from "@/lib/brand";

// Bitta video sahifasi — muqova, "Ko'rish" tugmasi va "Video mashq".

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

  const base = `/student/kurse/${code}/${lesson.id}`;
  const hasExercise = !!(lesson.assignment || safeUrl(lesson.assignmentFileUrl));

  return (
    <div>
      <SectionHeader
        backHref={`${base}/dars`}
        backLabel={t.back}
        title={`1-${t.videoSection.toLowerCase()}`}
        subtitle={`${unitLabel} · ${lesson.title}`}
        accent={VIDEO_ACCENT}
      />

      <div className="mt-4 space-y-3">
        <VideoCover lesson={lesson} watched={!!view} t={t} brand={await getBrand()} />

        {/* ── Video mashq ── */}
        <Link
          href={hasExercise ? `${base}/dars/mashq` : `${base}/vazifa`}
          className="flex min-h-[52px] w-full items-center justify-center rounded-[20px] text-[15px] font-extrabold text-white shadow-[0_12px_24px_-12px_rgba(15,60,80,0.8)] transition active:scale-[0.98]"
          style={{ background: VIDEO_ACCENT }}
        >
          {t.videoExercise}
        </Link>
      </div>
    </div>
  );
}
