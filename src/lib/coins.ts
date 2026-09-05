import "server-only";
import { prisma } from "./db";
import { getPointRules, type CoinRuleKey, type PointKind } from "./coinRules";
import { getProgressRules } from "./progressRules";
import { getActiveStarRanks, rankReward, ranksGained } from "./starRanks";

// Tanga va yulduz — o'quvchining faolligi uchun beriladigan ballar.
//
// Ikkalasi bir xil hodisalardan hisoblanadi, faqat qiymatlari boshqa:
//   tanga  — Market'da sovg'aga sarflanadi
//   yulduz — sarflanmaydi, yig'ilib boradi (umumiy yutuq)
//
// Alohida "balans" ustuni yo'q: hamma narsa mavjud yozuvlardan qayta
// hisoblanadi (davomat, baholangan vazifalar, o'yin natijalari, daraja
// ko'tarilishi). Shu sabab qoida o'zgarsa — barcha o'quvchining balansi
// darhol yangi qoida bo'yicha qayta hisoblanadi.

export const ATTENDED = ["PRESENT", "LATE", "ONLINE", "MAKEUP"];

/** "rankUp" — yulduz pog'onasiga chiqqani uchun mukofot (qoidalar jadvalida yo'q) */
export type CoinLineKey = CoinRuleKey | "rankUp";
/** `per` — bir hodisaga necha ball. Pog'ona mukofoti har pog'onada har xil,
 *  shuning uchun u yerda null bo'ladi va faqat jami ko'rsatiladi. */
export type CoinLine = { key: CoinLineKey; count: number; per: number | null; total: number };
export type CoinBalance = {
  earned: number;
  spent: number;
  balance: number;
  /** Har manba bo'yicha ajratma — o'quvchiga ham, direktorga ham ko'rsatiladi */
  lines: CoinLine[];
  streak: number;
};

/**
 * Oxirgi darsdan orqaga qarab uzluksiz qatnashgan darslar soni.
 * Sababli qoldirish (EXCUSED) sozlamaga qarab seriyani uzadi yoki
 * umuman hisobga olinmaydi (na uzadi, na qo'shadi).
 */
export function streakOf(rows: { status: string }[], excusedBreaks = false): number {
  let n = 0;
  for (const a of rows) {
    if (ATTENDED.includes(a.status)) { n++; continue; }
    if (a.status === "EXCUSED" && !excusedBreaks) continue; // o'tkazib yuboramiz
    break;
  }
  return n;
}

/** Portal sahifalari uchun qisqa yo'l — sozlamani o'zi o'qiydi */
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

/** Ball beriladigan hodisalar soni — tanga va yulduz uchun bir xil */
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
    // To'liq ballga bajarilgan vazifa uchun qo'shimcha
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

  // Yulduz pog'onasi. Yulduz hisobi SHU qatorsiz olinadi — aks holda
  // "pog'ona -> yulduz -> pog'ona" halqasi hosil bo'lardi. Shu sabab
  // pog'ona faqat TANGA beradi, yulduz emas.
  if (kind === "coin") {
    const stars = POINT_ORDER.reduce((n, k) => n + ev[k] * starRules[k], 0);
    lines.push({ key: "rankUp", count: ranksGained(ranks, stars), per: null, total: rankReward(ranks, stars) });
  }

  const earned = lines.reduce((n, l) => n + l.total, 0);
  // Yulduz sarflanmaydi — faqat tangada Market xarajati ayriladi
  const spent = kind === "coin" ? ev.spent : 0;
  return { earned, spent, balance: Math.max(0, earned - spent), lines, streak: ev.streak };
}

export const coinBalance = (studentId: string) => balanceOf(studentId, "coin");
export const starBalance = (studentId: string) => balanceOf(studentId, "star");
