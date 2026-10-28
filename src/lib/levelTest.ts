import { LEVEL_TEST_BANK } from "./levelTestBank";

export const LEVEL_TEST_LEVELS = ["A1", "A2", "B1", "B2"] as const;
export type TestLevel = (typeof LEVEL_TEST_LEVELS)[number];

export const TEST_SET_IDS = ["A1.1", "A1.2", "A2.1", "A2.2", "B1.1", "B1.2", "B2.1", "B2.2"] as const;
export type TestSetId = (typeof TEST_SET_IDS)[number];

export interface LevelTestQuestion {
  id: number;
  set: TestSetId;
  level: TestLevel;
  topic?: string;
  q: string;
  options: string[];
  answer: number;
}

export type PublicQuestion = Omit<LevelTestQuestion, "answer">;

export interface PublicSet {
  id: TestSetId;
  level: TestLevel;
  hint: string;
  questions: PublicQuestion[];
}

export const PASS_RATIO = 0.7;

export const LEVEL_COLORS: Record<TestLevel, string> = {
  A1: "#2d5f8a",
  A2: "#0e7490",
  B1: "#6d28d9",
  B2: "#a83a7a",
};

export const LEVEL_NAMES: Record<TestLevel, string> = {
  A1: "Boshlang'ich",
  A2: "Asosiy",
  B1: "O'rta",
  B2: "Yuqori o'rta",
};

export const SET_HINT: Record<TestSetId, string> = {
  "A1.1": "birinchi yarim", "A1.2": "ikkinchi yarim",
  "A2.1": "birinchi yarim", "A2.2": "ikkinchi yarim",
  "B1.1": "birinchi yarim", "B1.2": "ikkinchi yarim",
  "B2.1": "birinchi yarim", "B2.2": "ikkinchi yarim",
};

export const levelOfSet = (id: TestSetId): TestLevel => id.slice(0, 2) as TestLevel;

export const LEVEL_TEST_QUESTIONS: LevelTestQuestion[] = LEVEL_TEST_BANK;

const BY_ID = new Map(LEVEL_TEST_BANK.map((q) => [q.id, q]));

export function publicTestSets(): PublicSet[] {
  return TEST_SET_IDS.map((id) => ({
    id,
    level: levelOfSet(id),
    hint: SET_HINT[id],
    questions: LEVEL_TEST_BANK.filter((q) => q.set === id).map(({ id: qid, set, level, topic, q, options }) => ({ id: qid, set, level, topic, q, options })),
  }));
}

export interface SetResult {
  set: TestSetId;
  level: TestLevel;
  correct: number;
  total: number;
  pct: number;
  passed: boolean;
  resultLevel: TestLevel | null;
  nextLevel: TestLevel | null;
}

export function normalizeSetAnswers(setId: TestSetId, raw: Record<string, unknown>): Record<number, number> | null {
  const answers: Record<number, number> = {};
  for (const q of LEVEL_TEST_BANK) {
    if (q.set !== setId) continue;
    const v = Number(raw?.[String(q.id)]);
    if (!Number.isInteger(v) || v < 0 || v >= q.options.length) return null;
    answers[q.id] = v;
  }
  return Object.keys(answers).length ? answers : null;
}

export function gradeSet(setId: TestSetId, answers: Record<number, number | undefined>): SetResult {
  const level = levelOfSet(setId);
  let correct = 0;
  let total = 0;
  for (const q of LEVEL_TEST_BANK) {
    if (q.set !== setId) continue;
    total += 1;
    if (answers[q.id] === q.answer) correct += 1;
  }
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const passed = total > 0 && correct / total >= PASS_RATIO;
  const i = LEVEL_TEST_LEVELS.indexOf(level);
  const resultLevel = passed ? level : i > 0 ? LEVEL_TEST_LEVELS[i - 1] : null;
  const nextLevel = passed && i + 1 < LEVEL_TEST_LEVELS.length ? LEVEL_TEST_LEVELS[i + 1] : null;
  return { set: setId, level, correct, total, pct, passed, resultLevel, nextLevel };
}

export const isTestSetId = (v: unknown): v is TestSetId => typeof v === "string" && (TEST_SET_IDS as readonly string[]).includes(v);

export const questionById = (id: number) => BY_ID.get(id);
