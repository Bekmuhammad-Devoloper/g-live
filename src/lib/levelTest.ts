// Daraja aniqlash testi — tanlash va baholash.
//
// Savollar banki: src/lib/levelTestBank.ts (~190 savol, 4 daraja).
// Har urinishda har darajadan PER_LEVEL ta savol TASODIFIY tanlanadi va
// variantlar tartibi ham aralashtiriladi (`perm`) — to'g'ri javob doim
// bir joyda turmasin. Javob kaliti (`answer`) mijozga YUBORILMAYDI:
// sahifa `sampleLevelTest()` natijasini oladi, baholash faqat serverda.

import { LEVEL_TEST_BANK } from "./levelTestBank";

export const LEVEL_TEST_LEVELS = ["A1", "A2", "B1", "B2"] as const;
export type TestLevel = (typeof LEVEL_TEST_LEVELS)[number];

export interface LevelTestQuestion {
  id: number;
  level: TestLevel;
  /** Grammatik mavzu — savol ustida ko'rsatiladi (Perfekt, Dativ, ...) */
  topic?: string;
  /** Nemischa gap; bo'sh joy "___" bilan */
  q: string;
  options: string[];
  /** To'g'ri variant indeksi (faqat server) */
  answer: number;
}

/**
 * Mijozga boradigan ko'rinish — javobsiz. `options` aralashtirilgan,
 * `perm[j]` = ko'rsatilgan j-variantning bankdagi asl indeksi. Mijoz
 * javobni ASL indeks bilan yuboradi (perm[j]) — baholash bank bo'yicha.
 */
export interface PublicQuestion {
  id: number;
  level: TestLevel;
  topic?: string;
  q: string;
  options: string[];
  perm: number[];
}

/** Har darajadan nechta savol */
export const PER_LEVEL = 6;
/** Darajani "o'tgan" hisoblash uchun kamida shuncha to'g'ri javob (6 dan 4 = 67%) */
export const PASS_MIN = 4;

/** Daraja ranglari — Sozlamalar > Darajalar katalogidagi standart ranglar bilan bir xil */
export const LEVEL_COLORS: Record<TestLevel, string> = {
  A1: "#2d5f8a",
  A2: "#0e7490",
  B1: "#6d28d9",
  B2: "#a83a7a",
};

/** Bank — eski nom bilan ham (CRM va boshqa joylar shu nomni ishlatgan) */
export const LEVEL_TEST_QUESTIONS: LevelTestQuestion[] = LEVEL_TEST_BANK;

const BY_ID = new Map(LEVEL_TEST_BANK.map((q) => [q.id, q]));

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Bitta urinish uchun savollar to'plami: har darajadan PER_LEVEL ta, daraja tartibida. */
export function sampleLevelTest(perLevel = PER_LEVEL): PublicQuestion[] {
  const out: PublicQuestion[] = [];
  for (const level of LEVEL_TEST_LEVELS) {
    const pool = shuffle(LEVEL_TEST_BANK.filter((q) => q.level === level)).slice(0, perLevel);
    for (const q of pool) {
      const perm = shuffle(q.options.map((_, i) => i));
      out.push({ id: q.id, level: q.level, topic: q.topic, q: q.q, options: perm.map((i) => q.options[i]), perm });
    }
  }
  return out;
}

/** Eski nom — butun bankni javobsiz beradi (kerak bo'lsa) */
export function publicLevelTestQuestions(): Omit<LevelTestQuestion, "answer">[] {
  return LEVEL_TEST_BANK.map(({ id, level, topic, q, options }) => ({ id, level, topic, q, options }));
}

export interface LevelTestResult {
  /** Aniqlangan daraja; A1 ham o'tilmasa null (boshlang'ich) */
  level: TestLevel | null;
  correct: number;
  total: number;
  perLevel: Record<TestLevel, { correct: number; total: number }>;
}

/**
 * Javoblarni tozalash: faqat bankda bor savol id'lari va variant oralig'idagi
 * qiymatlar qoladi. Har darajada aynan `perLevel` ta javob bo'lishi shart —
 * aks holda null (to'liq emas).
 */
export function normalizeAnswers(raw: Record<string, unknown>, perLevel = PER_LEVEL): Record<number, number> | null {
  const answers: Record<number, number> = {};
  const count: Record<TestLevel, number> = { A1: 0, A2: 0, B1: 0, B2: 0 };
  for (const [k, v] of Object.entries(raw ?? {})) {
    const id = Number(k);
    const q = BY_ID.get(id);
    const idx = Number(v);
    if (!q || !Number.isInteger(idx) || idx < 0 || idx >= q.options.length) continue;
    if (count[q.level] >= perLevel) continue; // ortiqcha javoblar hisobga olinmaydi
    answers[id] = idx;
    count[q.level] += 1;
  }
  for (const l of LEVEL_TEST_LEVELS) if (count[l] !== perLevel) return null;
  return answers;
}

/**
 * Baholash: daraja ketma-ket o'tiladi — A1 dan boshlab har birida kamida
 * PASS_MIN to'g'ri bo'lsa keyingisiga o'tiladi; oxirgi o'tilgan daraja natija.
 * `answers` — savol id → tanlangan variantning ASL (bankdagi) indeksi.
 */
export function gradeLevelTest(answers: Record<number, number | undefined>, perLevel = PER_LEVEL): LevelTestResult {
  const perLevelRes = Object.fromEntries(LEVEL_TEST_LEVELS.map((l) => [l, { correct: 0, total: perLevel }])) as LevelTestResult["perLevel"];
  let correct = 0;
  for (const [k, v] of Object.entries(answers)) {
    const q = BY_ID.get(Number(k));
    if (!q || v === undefined) continue;
    if (v === q.answer) { perLevelRes[q.level].correct += 1; correct += 1; }
  }
  let level: TestLevel | null = null;
  for (const l of LEVEL_TEST_LEVELS) {
    if (perLevelRes[l].correct >= PASS_MIN) level = l;
    else break;
  }
  return { level, correct, total: perLevel * LEVEL_TEST_LEVELS.length, perLevel: perLevelRes };
}
