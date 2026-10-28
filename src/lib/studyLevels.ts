import "server-only";
import { cache } from "react";
import { prisma } from "./db";
import { tr } from "./tr";
import type { Locale } from "./constants";

export type StudyLevelRow = {
  id: string;
  code: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  nameDe: string;
  color: string;
  bannerUrl: string | null;
  sortOrder: number;
  isActive: boolean;
};

const SELECT = {
  id: true, code: true,
  nameUz: true, nameRu: true, nameEn: true, nameDe: true,
  color: true, bannerUrl: true, sortOrder: true, isActive: true,
} as const;

const DEFAULTS = [
  { code: "A1", nameUz: "Boshlang'ich", nameRu: "Начальный", nameEn: "Beginner", nameDe: "Anfänger", color: "#2d5f8a" },
  { code: "A2", nameUz: "Asosiy", nameRu: "Базовый", nameEn: "Elementary", nameDe: "Grundlagen", color: "#0e7490" },
  { code: "B1", nameUz: "O'rta", nameRu: "Средний", nameEn: "Intermediate", nameDe: "Mittelstufe", color: "#6d28d9" },
  { code: "B2", nameUz: "Yuqori o'rta", nameRu: "Выше среднего", nameEn: "Upper-intermediate", nameDe: "Fortgeschritten", color: "#a83a7a" },
  { code: "C1", nameUz: "Ilg'or", nameRu: "Продвинутый", nameEn: "Advanced", nameDe: "Sehr gut", color: "#b45309" },
  { code: "C2", nameUz: "Ona tili darajasi", nameRu: "Носитель языка", nameEn: "Proficient", nameDe: "Muttersprachlich", color: "#15803d" },
];

async function seedIfEmpty(): Promise<void> {
  if ((await prisma.studyLevel.count()) > 0) return;

  const keys = DEFAULTS.map((d) => `portal.levelBanner.${d.code}`);
  const old = await prisma.setting.findMany({ where: { key: { in: keys } }, select: { key: true, value: true } });
  const banner = new Map(old.map((r) => [r.key, r.value]));

  await prisma.studyLevel.createMany({
    data: DEFAULTS.map((d, i) => ({
      ...d,
      sortOrder: i,
      bannerUrl: banner.get(`portal.levelBanner.${d.code}`) || null,
    })),
  });
  if (old.length) await prisma.setting.deleteMany({ where: { key: { in: keys } } });
}

export const getStudyLevels = cache(async (): Promise<StudyLevelRow[]> => {
  await seedIfEmpty();
  return prisma.studyLevel.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }], select: SELECT });
});

export const getActiveLevels = cache(async (): Promise<StudyLevelRow[]> =>
  (await getStudyLevels()).filter((l) => l.isActive));

export const getLevelCodes = cache(async (): Promise<string[]> =>
  (await getActiveLevels()).map((l) => l.code));

export const levelTitle = (l: StudyLevelRow, locale: Locale) =>
  tr(locale, { uz: l.nameUz, ru: l.nameRu, en: l.nameEn, de: l.nameDe });

export function matchLevel(code: string | null | undefined, levels: StudyLevelRow[]): StudyLevelRow | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  return (
    levels.find((l) => l.code.toUpperCase() === c) ??
    levels.find((l) => c.startsWith(l.code.toUpperCase())) ??
    null
  );
}
