"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/db";

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

  revalidatePath("/student", "layout");
  return { ok: true };
}
