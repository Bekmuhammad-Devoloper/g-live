import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

/**
 * Daraja bo'yicha umumiy darslar.
 *
 * Bir darajadagi kurslar ("A1 Intensiv", "A1 Standart", "Standart A1 Qibray")
 * darslarni birga ishlatadi: dars bitta kursga kiritilsa, shu darajadagi barcha
 * guruhlarga ko'rinadi. Kurs darajasi nomidagi yagona CEFR kodidan aniqlanadi;
 * nomida daraja bo'lmagan yoki bir nechta daraja yozilgan kurslar ("Ingliz tili",
 * "Nemis tili (A1–B2)") ulashilmaydi — faqat o'z darslarini ko'radi.
 */

const LEVEL_RE = /(?:^|[^A-Za-z0-9])(A1|A2|B1|B2|C1|C2)(?![0-9])/gi;

/** Kurs nomidagi yagona daraja ("Standart A1 Qibray" → "A1"), aks holda null */
export function programLevel(name: string | null | undefined): string | null {
  if (!name) return null;
  const found = new Set(Array.from(name.matchAll(LEVEL_RE), (m) => m[1].toUpperCase()));
  return found.size === 1 ? Array.from(found)[0] : null;
}

const norm = (code: string | null | undefined) => (code ? code.slice(0, 2).toUpperCase() : null);

export interface LessonGroupRef { programId: string; levelCode?: string | null }

/** Guruh ko'radigan darslar sharti: o'z kursi + shu darajadagi boshqa kurslarning shu darajadagi darslari */
export async function groupLessonsWhere(group: LessonGroupRef): Promise<Prisma.CourseLessonWhereInput> {
  const programs = await prisma.program.findMany({ select: { id: true, name: true } });
  const own = programs.find((p) => p.id === group.programId);
  const level = norm(group.levelCode) ?? programLevel(own?.name);
  if (!level) return { programId: group.programId };

  const shared = programs.filter((p) => p.id !== group.programId && programLevel(p.name) === level).map((p) => p.id);
  if (shared.length === 0) return { programId: group.programId };

  return {
    OR: [
      { programId: group.programId },
      // Boshqa kurslardan: darajasi shu daraja yoki belgilanmagan (kurs darajasiga tegishli) darslar
      { programId: { in: shared }, OR: [{ levelCode: { startsWith: level } }, { levelCode: null }] },
    ],
  };
}

/** Bir nechta guruh (o'quvchining faol guruhlari) uchun birlashgan shart */
export async function groupsLessonsWhere(groups: LessonGroupRef[]): Promise<Prisma.CourseLessonWhereInput> {
  if (groups.length === 0) return { id: "__none__" };
  if (groups.length === 1) return groupLessonsWhere(groups[0]);
  return { OR: await Promise.all(groups.map(groupLessonsWhere)) };
}

/** Dars shu guruh(lar)ga ko'rinadimi — boshqa darajadagi darsga URL orqali kirib bo'lmasin */
export async function lessonVisibleToGroups(lessonId: string, groups: LessonGroupRef[]): Promise<boolean> {
  if (groups.length === 0) return false;
  const where = await groupsLessonsWhere(groups);
  return (await prisma.courseLesson.count({ where: { AND: [{ id: lessonId }, where] } })) > 0;
}
