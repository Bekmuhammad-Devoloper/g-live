import "server-only";
import { cache } from "react";
import { getSettings, setSetting } from "./settings";

export type RankScope = "group" | "branch" | "center";
export type RankBasis = "attendance" | "coins" | "score";

export type ProgressRules = {
  streakExcusedBreaks: boolean;
  streakStep: number;
  rankScope: RankScope;
  rankBasis: RankBasis;
  skillDecayPerDay: number;
};

export const PROGRESS_DEFAULTS: ProgressRules = {
  streakExcusedBreaks: false,
  streakStep: 7,
  rankScope: "center",
  rankBasis: "attendance",
  skillDecayPerDay: 5,
};

export const RANK_SCOPES: RankScope[] = ["group", "branch", "center"];
export const RANK_BASES: RankBasis[] = ["attendance", "coins", "score"];

const K = {
  streakExcusedBreaks: "progress.streakExcusedBreaks",
  streakStep: "progress.streakStep",
  rankScope: "progress.rankScope",
  rankBasis: "progress.rankBasis",
  skillDecayPerDay: "progress.skillDecayPerDay",
} as const;

export const getProgressRules = cache(async (): Promise<ProgressRules> => {
  const r = await getSettings(Object.values(K));
  const step = Math.round(Number(r[K.streakStep]));
  const scope = r[K.rankScope] as RankScope;
  const basis = r[K.rankBasis] as RankBasis;
  const decay = Math.round(Number(r[K.skillDecayPerDay]));

  return {
    streakExcusedBreaks: r[K.streakExcusedBreaks] === "1",
    streakStep: Number.isFinite(step) && step >= 2 && step <= 100 ? step : PROGRESS_DEFAULTS.streakStep,
    rankScope: RANK_SCOPES.includes(scope) ? scope : PROGRESS_DEFAULTS.rankScope,
    rankBasis: RANK_BASES.includes(basis) ? basis : PROGRESS_DEFAULTS.rankBasis,
    skillDecayPerDay: r[K.skillDecayPerDay] !== undefined && r[K.skillDecayPerDay] !== "" && Number.isFinite(decay) && decay >= 0 && decay <= 100
      ? decay
      : PROGRESS_DEFAULTS.skillDecayPerDay,
  };
});

export async function setProgressRules(input: Partial<ProgressRules>): Promise<void> {
  if (input.streakExcusedBreaks !== undefined) {
    await setSetting(K.streakExcusedBreaks, input.streakExcusedBreaks ? "1" : "0");
  }
  if (input.streakStep !== undefined) {
    const n = Math.round(Number(input.streakStep));
    await setSetting(K.streakStep, String(Number.isFinite(n) && n >= 2 && n <= 100 ? n : PROGRESS_DEFAULTS.streakStep));
  }
  if (input.rankScope !== undefined && RANK_SCOPES.includes(input.rankScope)) {
    await setSetting(K.rankScope, input.rankScope);
  }
  if (input.rankBasis !== undefined && RANK_BASES.includes(input.rankBasis)) {
    await setSetting(K.rankBasis, input.rankBasis);
  }
  if (input.skillDecayPerDay !== undefined) {
    const n = Math.round(Number(input.skillDecayPerDay));
    await setSetting(K.skillDecayPerDay, String(Number.isFinite(n) && n >= 0 && n <= 100 ? n : PROGRESS_DEFAULTS.skillDecayPerDay));
  }
}
