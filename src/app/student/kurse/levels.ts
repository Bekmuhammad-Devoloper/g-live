import type { Locale, LocaleText } from "@/lib/constants";
import { tr } from "@/lib/tr";

// Kurs darajalari — sahifalar orasida umumiy (Next.js page fayllaridan
// qo'shimcha eksport qilib bo'lmaydi, shuning uchun alohida modul).

export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

// Har daraja uchun karta foni (maketdagi "tog'" gradientlari uslubida)
export const LEVEL_BG: Record<string, string> = {
  A1: "linear-gradient(135deg, #1e3a5f 0%, #2d5f8a 55%, #4a89b8 100%)",
  A2: "linear-gradient(135deg, #164e63 0%, #0e7490 55%, #22a5c4 100%)",
  B1: "linear-gradient(135deg, #4c1d95 0%, #6d28d9 55%, #9b6ee8 100%)",
  B2: "linear-gradient(135deg, #7c2d5e 0%, #a83a7a 55%, #cf68a4 100%)",
  C1: "linear-gradient(135deg, #7c3a12 0%, #b45309 55%, #e0912f 100%)",
  C2: "linear-gradient(135deg, #14532d 0%, #15803d 55%, #34a853 100%)",
};

export const LEVEL_NAME: Record<string, LocaleText> = {
  A1: { uz: "Boshlang'ich", ru: "Начальный", en: "Beginner", de: "Anfänger" },
  A2: { uz: "Asosiy", ru: "Базовый", en: "Elementary", de: "Grundlagen" },
  B1: { uz: "O'rta", ru: "Средний", en: "Intermediate", de: "Mittelstufe" },
  B2: { uz: "Yuqori o'rta", ru: "Выше среднего", en: "Upper-intermediate", de: "Fortgeschritten" },
  C1: { uz: "Ilg'or", ru: "Продвинутый", en: "Advanced", de: "Sehr gut" },
  C2: { uz: "Ona tili darajasi", ru: "Носитель языка", en: "Proficient", de: "Muttersprachlich" },
};

export const levelName = (code: string, locale: Locale) =>
  LEVEL_NAME[code] ? tr(locale, LEVEL_NAME[code]) : code;
