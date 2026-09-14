// Daraja aniqlash testi — savollar banki va baholash.
// Ochiq sahifa /daraja-testi shu bankdan foydalanadi; javob kaliti (`answer`)
// mijozga YUBORILMAYDI — sahifa `publicLevelTestQuestions()` ni oladi,
// baholash faqat serverda (`gradeLevelTest`).

export const LEVEL_TEST_LEVELS = ["A1", "A2", "B1", "B2"] as const;
export type TestLevel = (typeof LEVEL_TEST_LEVELS)[number];

export interface LevelTestQuestion {
  id: number;
  level: TestLevel;
  /** Nemischa gap; bo'sh joy "___" bilan */
  q: string;
  options: string[];
  /** To'g'ri variant indeksi (faqat server) */
  answer: number;
}

/** Mijozga boradigan ko'rinish — javobsiz */
export type PublicQuestion = Omit<LevelTestQuestion, "answer">;

/** Har darajadan nechta savol */
export const PER_LEVEL = 6;
/** Darajani "o'tgan" hisoblash uchun kamida shuncha to'g'ri javob (6 dan 4 = 67%) */
export const PASS_MIN = 4;

export const LEVEL_TEST_QUESTIONS: LevelTestQuestion[] = [
  // ── A1 ──
  { id: 1, level: "A1", q: "Ich ___ Student.", options: ["bist", "bin", "ist", "sind"], answer: 1 },
  { id: 2, level: "A1", q: "Wie ___ du?", options: ["heiße", "heißt", "heißen", "heiß"], answer: 1 },
  { id: 3, level: "A1", q: "Das ist ___ Buch.", options: ["eine", "einen", "ein", "einer"], answer: 2 },
  { id: 4, level: "A1", q: "Ich komme ___ Usbekistan.", options: ["von", "in", "aus", "nach"], answer: 2 },
  { id: 5, level: "A1", q: "Wir ___ nach Berlin.", options: ["fahre", "fährst", "fährt", "fahren"], answer: 3 },
  { id: 6, level: "A1", q: "___ du Kaffee?", options: ["Trinkt", "Trinke", "Trinken", "Trinkst"], answer: 3 },
  // ── A2 ──
  { id: 7, level: "A2", q: "Gestern ___ ich ins Kino gegangen.", options: ["habe", "war", "bin", "hatte"], answer: 2 },
  { id: 8, level: "A2", q: "Ich habe ___ Auto gekauft.", options: ["eine", "ein", "einen", "einem"], answer: 1 },
  { id: 9, level: "A2", q: "Er kommt nicht, ___ er krank ist.", options: ["denn", "aber", "weil", "oder"], answer: 2 },
  { id: 10, level: "A2", q: "Ich freue mich ___ das Wochenende.", options: ["über", "auf", "an", "für"], answer: 1 },
  { id: 11, level: "A2", q: "Das Buch ist ___ als der Film.", options: ["interessant", "am interessantesten", "interessanter", "interessantesten"], answer: 2 },
  { id: 12, level: "A2", q: "Kannst du ___ helfen?", options: ["ich", "mich", "mein", "mir"], answer: 3 },
  // ── B1 ──
  { id: 13, level: "B1", q: "Wenn ich Zeit ___, würde ich mehr lesen.", options: ["habe", "hatte", "hätte", "haben"], answer: 2 },
  { id: 14, level: "B1", q: "Das Haus, ___ wir gekauft haben, ist alt.", options: ["den", "das", "dem", "der"], answer: 1 },
  { id: 15, level: "B1", q: "Der Brief ___ gestern geschrieben.", options: ["wird", "ist", "hat", "wurde"], answer: 3 },
  { id: 16, level: "B1", q: "Ich lerne Deutsch, ___ in Deutschland zu studieren.", options: ["für", "damit", "um", "weil"], answer: 2 },
  { id: 17, level: "B1", q: "Ich interessiere mich ___ Musik.", options: ["an", "für", "auf", "über"], answer: 1 },
  { id: 18, level: "B1", q: "Ich habe keine Lust, ___ Hausaufgaben zu machen.", options: ["den", "der", "das", "die"], answer: 3 },
  // ── B2 ──
  { id: 19, level: "B2", q: "___ er viel gearbeitet hatte, war er müde.", options: ["Bevor", "Während", "Nachdem", "Obwohl"], answer: 2 },
  { id: 20, level: "B2", q: "Die Ergebnisse ___ noch überprüft werden.", options: ["muss", "müssen", "gemusst", "müsste"], answer: 1 },
  { id: 21, level: "B2", q: "Er tat so, ___ er nichts wüsste.", options: ["obwohl", "wenn", "als ob", "als"], answer: 2 },
  { id: 22, level: "B2", q: "Trotz ___ schlechten Wetters fand das Konzert statt.", options: ["dem", "des", "der", "den"], answer: 1 },
  { id: 23, level: "B2", q: "Je mehr man übt, ___ besser wird man.", options: ["so", "als", "desto", "wie"], answer: 2 },
  { id: 24, level: "B2", q: "Die Stadt, in ___ ich wohne, ist sehr alt.", options: ["die", "dem", "der", "den"], answer: 2 },
];

export function publicLevelTestQuestions(): PublicQuestion[] {
  return LEVEL_TEST_QUESTIONS.map(({ id, level, q, options }) => ({ id, level, q, options }));
}

export interface LevelTestResult {
  /** Aniqlangan daraja; A1 ham o'tilmasa null (boshlang'ich) */
  level: TestLevel | null;
  correct: number;
  total: number;
  perLevel: Record<TestLevel, { correct: number; total: number }>;
}

/**
 * Baholash: daraja ketma-ket o'tiladi — A1 dan boshlab har birida kamida
 * PASS_MIN to'g'ri bo'lsa keyingisiga o'tiladi; oxirgi o'tilgan daraja natija.
 * `answers` — savol id → tanlangan variant indeksi (javob berilmagani bo'lmasligi mumkin).
 */
export function gradeLevelTest(answers: Record<number, number | undefined>): LevelTestResult {
  const perLevel = Object.fromEntries(LEVEL_TEST_LEVELS.map((l) => [l, { correct: 0, total: 0 }])) as LevelTestResult["perLevel"];
  let correct = 0;
  for (const q of LEVEL_TEST_QUESTIONS) {
    perLevel[q.level].total += 1;
    if (answers[q.id] === q.answer) { perLevel[q.level].correct += 1; correct += 1; }
  }
  let level: TestLevel | null = null;
  for (const l of LEVEL_TEST_LEVELS) {
    if (perLevel[l].correct >= PASS_MIN) level = l;
    else break;
  }
  return { level, correct, total: LEVEL_TEST_QUESTIONS.length, perLevel };
}
