import "server-only";
import { prisma } from "./db";

// Tanga (Münzen) — o'quvchining faolligi uchun beriladigan ichki ball.
// Start ekranidagi hisob bilan bir xil: har qatnashgan dars 5, har baholangan
// vazifa 10 tanga. Sarflangani Market buyurtmalaridan olinadi (bekor
// qilinganlari hisobga kirmaydi), shu sabab alohida "balans" ustuni kerak emas.

export const COIN_PER_LESSON = 5;
export const COIN_PER_TASK = 10;

const ATTENDED = ["PRESENT", "LATE", "ONLINE", "MAKEUP"];

export type CoinBalance = { earned: number; spent: number; balance: number };

export async function coinBalance(studentId: string): Promise<CoinBalance> {
  const [lessons, tasks, spentAgg] = await Promise.all([
    prisma.attendance.count({ where: { studentId, status: { in: ATTENDED } } }),
    prisma.submission.count({ where: { studentId, status: "GRADED" } }),
    prisma.marketOrder.aggregate({
      where: { studentId, status: { not: "CANCELLED" } },
      _sum: { price: true },
    }),
  ]);

  const earned = lessons * COIN_PER_LESSON + tasks * COIN_PER_TASK;
  const spent = spentAgg._sum.price ?? 0;
  return { earned, spent, balance: Math.max(0, earned - spent) };
}
