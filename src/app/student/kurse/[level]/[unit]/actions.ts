"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { lessonVocabText, parseLessonWords, practicableWords } from "@/lib/lessonWords";
import { awardSkill } from "@/lib/skills";

// Dars videosi ko'rib chiqilgani — har darsga BIR marta yoziladi.
// Shu yozuv bo'yicha o'quvchiga tanga va yulduz beriladi.

export async function markLessonWatched(lessonId: string): Promise<{ ok?: boolean; error?: string }> {
  const s = await getSession();
  if (!s || s.role !== ROLES.STUDENT) return { error: "forbidden" };

  const student = await prisma.student.findUnique({
    where: { userId: s.userId },
    select: {
      id: true,
      enrollments: {
        where: { isActive: true },
        select: { group: { select: { programId: true } } },
      },
    },
  });
  if (!student) return { error: "forbidden" };

  // Faqat o'z kursidagi dars sanaladi — boshqa kursning darsi orqali
  // ball yig'ib bo'lmasin
  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    select: { id: true, programId: true },
  });
  if (!lesson) return { error: "invalid" };
  if (!student.enrollments.some((e) => e.group.programId === lesson.programId)) return { error: "forbidden" };

  // Takroriy ko'rish qo'shimcha ball bermaydi
  await prisma.lessonView.upsert({
    where: { studentId_courseLessonId: { studentId: student.id, courseLessonId: lesson.id } },
    create: { studentId: student.id, courseLessonId: lesson.id },
    update: {},
  });

  // "Tinglash" ko'nikmasi — dars videosi ko'rilgani (darsga bir marta)
  await awardSkill(student.id, "lessonView", `view:${lesson.id}`);

  revalidatePath("/student", "layout");
  return { ok: true };
}

// Lug'at mashqining bosqichi tugadi — ko'nikma balli.
//
// Har bosqich o'z ko'nikmasiga ball beradi (lib/skillMath.ts SKILL_POINTS):
// 1-2 (tanish/teskari) → So'zlar, 3 (yig'ish) → O'qish, 4 (talaffuz) → Gapirish.
// Kalit dars+bosqich: xuddi shu darsni qayta mashq qilib ball yig'ib
// bo'lmaydi. Enrollment tekshiruvi markLessonWatched dagi bilan bir xil.
export async function recordVocabStage(lessonId: string, stage: number): Promise<{ ok?: boolean; error?: string }> {
  const s = await getSession();
  if (!s || s.role !== ROLES.STUDENT) return { error: "forbidden" };
  if (![1, 2, 3, 4].includes(stage)) return { error: "invalid" };

  const student = await prisma.student.findUnique({
    where: { userId: s.userId },
    select: { id: true, enrollments: { where: { isActive: true }, select: { group: { select: { programId: true } } } } },
  });
  if (!student) return { error: "forbidden" };

  const lesson = await prisma.courseLesson.findUnique({ where: { id: lessonId }, select: { id: true, programId: true } });
  if (!lesson) return { error: "invalid" };
  if (!student.enrollments.some((e) => e.group.programId === lesson.programId)) return { error: "forbidden" };

  const type = (["vocabStage1", "vocabStage2", "vocabStage3", "vocabStage4"] as const)[stage - 1];
  await awardSkill(student.id, type, `vocab:${lesson.id}:s${stage}`);

  revalidatePath("/student", "layout");
  return { ok: true };
}

// Darsning lug'ati o'zlashtirilgani — mashqda hamma so'z to'g'ri tanlangach.
//
// Bu yerda so'zlar QAYTA sanaladi: mijoz "tugadim" deb yuborgan songa
// ishonib bo'lmaydi (so'rovni qo'lda yasab yuborish mumkin). Shu sabab
// darsning o'z matnidan nechta so'z borligi olinadi va kamida ikkita so'z
// bo'lishi tekshiriladi — mashqning o'zi shundagina mavjud.
export async function markVocabMastered(lessonId: string): Promise<{ ok?: boolean; error?: string }> {
  const s = await getSession();
  if (!s || s.role !== ROLES.STUDENT) return { error: "forbidden" };

  const student = await prisma.student.findUnique({
    where: { userId: s.userId },
    select: {
      id: true,
      enrollments: {
        where: { isActive: true },
        select: { group: { select: { programId: true } } },
      },
    },
  });
  if (!student) return { error: "forbidden" };

  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    select: { id: true, programId: true, topic: true, vocabText: true },
  });
  if (!lesson) return { error: "invalid" };
  if (!student.enrollments.some((e) => e.group.programId === lesson.programId)) return { error: "forbidden" };

  // Mashq qilinadigan so'zlar — tarjimasi borlari (savol o'zbekcha beriladi)
  const words = practicableWords(parseLessonWords(lessonVocabText(lesson)));
  if (words.length < 2) return { error: "invalid" };

  await prisma.vocabMastery.upsert({
    where: { studentId_courseLessonId: { studentId: student.id, courseLessonId: lesson.id } },
    create: { studentId: student.id, courseLessonId: lesson.id, words: words.length },
    update: { words: words.length },
  });

  revalidatePath("/student", "layout");
  return { ok: true };
}
