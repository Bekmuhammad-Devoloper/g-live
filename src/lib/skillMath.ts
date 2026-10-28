export const SKILL_KINDS = ["words", "reading", "listening", "speaking"] as const;
export type SkillKind = (typeof SKILL_KINDS)[number];
export type SkillScores = Record<SkillKind, number>;

export const DAY_MS = 24 * 60 * 60 * 1000;

export const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function pendingDecayDays(lastActiveAt: Date, decayedAt: Date, now: Date): { days: number; decayedThrough: Date } {
  const start = Math.max(lastActiveAt.getTime(), decayedAt.getTime());
  const days = Math.max(0, Math.floor((now.getTime() - start) / DAY_MS));
  return { days, decayedThrough: new Date(start + days * DAY_MS) };
}

export function applyDecay(scores: SkillScores, days: number, rate: number): SkillScores {
  if (days <= 0 || rate <= 0) return { ...scores };
  const out = { ...scores };
  for (const k of SKILL_KINDS) out[k] = clampScore(out[k] - days * rate);
  return out;
}

export function addPoints(scores: SkillScores, kind: SkillKind, points: number): SkillScores {
  return { ...scores, [kind]: clampScore(scores[kind] + points) };
}

export const SKILL_POINTS = {
  vocabStage1: { kind: "words" as const, points: 6 },
  vocabStage2: { kind: "words" as const, points: 6 },
  vocabStage3: { kind: "reading" as const, points: 6 },
  vocabStage4: { kind: "speaking" as const, points: 8 },
  sayWord: { kind: "speaking" as const, points: 1 },
  lessonView: { kind: "listening" as const, points: 10 },
  homework: { kind: "reading" as const, points: 8 },
  homeworkPerfect: { kind: "reading" as const, points: 4 },
  gameWords: { kind: "words" as const, points: 4 },
  gameGrammar: { kind: "reading" as const, points: 4 },
} as const;

export const GAME_MIN_ACCURACY = 0.7;

export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export type SkillEventType = keyof typeof SKILL_POINTS;
