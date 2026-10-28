import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

const LEVEL_RE = /(?:^|[^A-Za-z0-9])(A1|A2|B1|B2|C1|C2)(?![0-9])/gi;

export function programLevel(name: string | null | undefined): string | null {
  if (!name) return null;
  const found = new Set(Array.from(name.matchAll(LEVEL_RE), (m) => m[1].toUpperCase()));
  return found.size === 1 ? Array.from(found)[0] : null;
}

const norm = (code: string | null | undefined) => (code ? code.slice(0, 2).toUpperCase() : null);

export interface LessonGroupRef { programId: string; levelCode?: string | null }

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
      { programId: { in: shared }, OR: [{ levelCode: { startsWith: level } }, { levelCode: null }] },
    ],
  };
}

export async function groupsLessonsWhere(groups: LessonGroupRef[]): Promise<Prisma.CourseLessonWhereInput> {
  if (groups.length === 0) return { id: "__none__" };
  if (groups.length === 1) return groupLessonsWhere(groups[0]);
  return { OR: await Promise.all(groups.map(groupLessonsWhere)) };
}

export async function lessonVisibleToGroups(lessonId: string, groups: LessonGroupRef[]): Promise<boolean> {
  if (groups.length === 0) return false;
  const where = await groupsLessonsWhere(groups);
  return (await prisma.courseLesson.count({ where: { AND: [{ id: lessonId }, where] } })) > 0;
}
