import "server-only";
import { prisma } from "./db";
import { getCoinRules, STREAK_STEP, type CoinRuleKey } from "./coinRules";

// Tanga (Münzen) — o'quvchining faolligi uchun beriladigan ichki ball.
//
// Alohida "balans" ustuni yo'q: hamma narsa mavjud yozuvlardan qayta
// hisoblanadi (davomat, baholangan vazifalar, o'yin natijalari, daraja
// ko'tarilishi), sarflangani esa Market buyurtmalaridan olinadi. Shu sabab
// qoida o'zgarsa — barcha o'quvchining balansi darhol yangi qoida bo'yicha
// qayta hisoblanadi, hech qayerni "to'g'rilash" kerak emas.

export const ATTENDED = ["PRESENT", "LATE", "ONLINE", "MAKEUP"];

export type CoinLine = { key: CoinRuleKey; count: number; per: number; total: number };
export type CoinBalance = {
  earned: number;
  spent: number;
  balance: number;
  /** Har manba bo'yicha ajratma — o'quvchiga ham, direktorga ham ko'rsatiladi */
  lines: CoinLine[];
  streak: number;
};

/** Oxirgi darsdan orqaga qarab uzluksiz qatnashgan darslar soni */
export function streakOf(rows: { status: string }[]): number {
  let n = 0;
  for (const a of rows) {
    if (ATTENDED.includes(a.status)) n++;
    else break;
  }
  return n;
}

export async function coinBalance(studentId: string): Promise<CoinBalance> {
  const rules = await getCoinRules();

  const [attendance, graded, games, levelUps, spentAgg] = await Promise.all([
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
    prisma.marketOrder.aggregate({
      where: { studentId, status: { not: "CANCELLED" } },
      _sum: { price: true },
    }),
  ]);

  const lessons = attendance.filter((a) => ATTENDED.includes(a.status)).length;
  // To'liq ballga bajarilgan vazifa uchun qo'shimcha
  const perfect = graded.filter((s) => {
    const max = s.assignment?.maxScore || 0;
    return max > 0 && (s.score ?? 0) >= max;
  }).length;

  const streak = streakOf(attendance);
  const streakSteps = Math.floor(streak / STREAK_STEP);

  const lines: CoinLine[] = [
    { key: "lesson", count: lessons, per: rules.lesson, total: lessons * rules.lesson },
    { key: "homework", count: graded.length, per: rules.homework, total: graded.length * rules.homework },
    { key: "perfect", count: perfect, per: rules.perfect, total: perfect * rules.perfect },
    { key: "gameWin", count: games, per: rules.gameWin, total: games * rules.gameWin },
    { key: "streak7", count: streakSteps, per: rules.streak7, total: streakSteps * rules.streak7 },
    { key: "levelUp", count: levelUps, per: rules.levelUp, total: levelUps * rules.levelUp },
  ];

  const earned = lines.reduce((n, l) => n + l.total, 0);
  const spent = spentAgg._sum.price ?? 0;
  return { earned, spent, balance: Math.max(0, earned - spent), lines, streak };
}
