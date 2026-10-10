import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { lessonLinkPath } from "@/lib/lessonLink";
import { qrStudentOf } from "@/lib/lessonQrAccess";
import { S } from "../../../_i18n";
import MissingStudent from "../../../MissingStudent";
import { SectionHeader } from "../../../kurse/[level]/[unit]/_parts";
import VideoCover, { VIDEO_ACCENT } from "../../../kurse/[level]/[unit]/dars/video/Cover";
import { getBrand } from "@/lib/brand";

// QR orqali ochiladigan video dars — o'quvchining O'Z kursidan bo'lmagan dars uchun.
//
// Ilovadagi dars sahifalari (kurse/[level]/[unit]) faqat o'quvchi guruhining
// kursidagi darsni ochadi. QR esa markazning istalgan guruhidagi faol o'quvchiga
// darsni bepul ko'rsatishi kerak — shuning uchun alohida sahifa: faqat video,
// lug'at/vazifa bo'limlarisiz. O'z kursidagi dars bu yerga kelmaydi (/l/<id> uni
// ilovadagi o'z joyiga yo'naltiradi).
//
// Manzilda "/dars/video" bo'lishi shart: Android ilovasi ekran himoyasini
// (skrinshot/yozib olish taqiqi) shu bo'lak bo'yicha yoqadi.

export default async function QrLessonVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(lessonLinkPath(id))}`);

  const st = await qrStudentOf(session.userId);
  if (!st) return <MissingStudent />;
  // Faol guruhi yo'q — tushuntirish xabari /l/<id> da
  if (st.groups.length === 0) redirect(lessonLinkPath(id));

  const lesson = await prisma.courseLesson.findUnique({
    where: { id },
    select: { id: true, title: true, topic: true, levelCode: true, videoUrl: true, videoPosterUrl: true, program: { select: { name: true } } },
  });
  if (!lesson) notFound();

  const view = await prisma.lessonView.findFirst({
    where: { studentId: st.id, courseLessonId: lesson.id },
    select: { id: true },
  });

  const t = S(session.locale);

  return (
    <div>
      <SectionHeader
        backHref="/student/kurse"
        backLabel={t.back}
        title={lesson.title}
        subtitle={[lesson.program.name, lesson.levelCode].filter(Boolean).join(" · ")}
        accent={VIDEO_ACCENT}
      />

      <div className="mt-4 space-y-3">
        <VideoCover lesson={lesson} watched={!!view} t={t} brand={await getBrand()} />

        {lesson.topic && (
          <div className="gl-glass rounded-[24px] p-4">
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-slate-700">{lesson.topic}</p>
          </div>
        )}
      </div>
    </div>
  );
}
