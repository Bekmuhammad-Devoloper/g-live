import "server-only";
import { prisma } from "./db";
import { getPointRules, type CoinRuleKey, type PointKind } from "./coinRules";
import { getProgressRules } from "./progressRules";
import { getActiveStarRanks, rankReward, ranksGained } from "./starRanks";

export const ATTENDED = ["PRESENT", "LATE", "ONLINE", "MAKEUP"];

export type CoinLineKey = CoinRuleKey | "rankUp";
export type CoinLine = { key: CoinLineKey; count: number; per: number | null; total: number };
export type CoinBalance = {
  earned: number;
  spent: number;
  balance: number;
  lines: CoinLine[];
  streak: number;
};

export function streakOf(rows: { status: string }[], excusedBreaks = false): number {
  let n = 0;
  for (const a of rows) {
    if (ATTENDED.includes(a.status)) { n++; continue; }
    if (a.status === "EXCUSED" && !excusedBreaks) continue;
    break;
  }
  return n;
}

export async function studentStreak(studentId: string): Promise<number> {
  const [rows, rules] = await Promise.all([
    prisma.attendance.findMany({
      where: { studentId },
      orderBy: { markedAt: "desc" },
      select: { status: true },
      take: 400,
    }),
    getProgressRules(),
  ]);
  return streakOf(rows, rules.streakExcusedBreaks);
}

type Events = Record<CoinRuleKey, number> & { streak: number; spent: number };

async function pointEvents(studentId: string): Promise<Events> {
  const [attendance, graded, games, levelUps, views, spentAgg, prog] = await Promise.all([
    prisma.attendance.findMany({
      where: { studentId },
      orderBy: { markedAt: "desc" },
      select: { status: true },
      take: 400,
    }),
    prisma.submission.findMany({
      where: { studentId, status: "GRADED" },
      select: { score: true, assignment: { select: { maxScore: true } } },
    }),
    prisma.gameResult.count({ where: { studentId, won: true } }),
    prisma.studentLevelUp.count({ where: { studentId } }),
    prisma.lessonView.count({ where: { studentId } }),
    prisma.marketOrder.aggregate({
      where: { studentId, status: { not: "CANCELLED" } },
      _sum: { price: true },
    }),
    getProgressRules(),
  ]);

  const streak = streakOf(attendance, prog.streakExcusedBreaks);

  return {
    lesson: attendance.filter((a) => ATTENDED.includes(a.status)).length,
    lessonView: views,
    homework: graded.length,
    perfect: graded.filter((s) => {
      const max = s.assignment?.maxScore || 0;
      return max > 0 && (s.score ?? 0) >= max;
    }).length,
    gameWin: games,
    streak7: Math.floor(streak / prog.streakStep),
    levelUp: levelUps,
    streak,
    spent: spentAgg._sum.price ?? 0,
  };
}

export const POINT_ORDER: CoinRuleKey[] = ["lesson", "lessonView", "homework", "perfect", "gameWin", "streak7", "levelUp"];

async function balanceOf(studentId: string, kind: PointKind): Promise<CoinBalance> {
  const [rules, starRules, ev, ranks] = await Promise.all([
    getPointRules(kind),
    getPointRules("star"),
    pointEvents(studentId),
    getActiveStarRanks(),
  ]);

  const lines: CoinLine[] = POINT_ORDER.map((k) => ({
    key: k,
    count: ev[k],
    per: rules[k],
    total: ev[k] * rules[k],
  }));

  if (kind === "coin") {
    const stars = POINT_ORDER.reduce((n, k) => n + ev[k] * starRules[k], 0);
    lines.push({ key: "rankUp", count: ranksGained(ranks, stars), per: null, total: rankReward(ranks, stars) });
  }

  const earned = lines.reduce((n, l) => n + l.total, 0);
  const spent = kind === "coin" ? ev.spent : 0;
  return { earned, spent, balance: Math.max(0, earned - spent), lines, streak: ev.streak };
}

export const coinBalance = (studentId: string) => balanceOf(studentId, "coin");
export const starBalance = (studentId: string) => balanceOf(studentId, "star");
