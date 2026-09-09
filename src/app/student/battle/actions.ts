"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { isPortalFeatureOn } from "@/lib/portalFeatures";
import { awardSkill } from "@/lib/skills";
import { dayKey, GAME_MIN_ACCURACY } from "@/lib/skillMath";
import { notify } from "@/lib/notify";
import { LT, S } from "../_i18n";

// O'yin natijasini saqlash va chaqiruvlar (duel / guruhli o'yin).
// Ballni mijoz yuboradi, shu sabab cheklovlar shu yerda: raund soni
// belgilangan chegaradan oshmaydi va bir kunda sanaladigan o'yin soni cheklangan.

const GAMES = ["vocabulary", "wordgame", "crossword", "grammar"];
const MODES = ["ai", "duel", "group"];
const MAX_ROUNDS = 30;
const MAX_PER_DAY = 20; // kuniga shuncha o'yin yoziladi, ortig'i saqlanmaydi
const CHALLENGE_DAYS = 3; // chaqiruv shuncha kun kutadi

// O'quvchi + uning tilidagi matnlar (xato xabarlari o'quvchi tilida qaytsin)
async function me() {
  const s = await getSession();
  if (!s || s.role !== ROLES.STUDENT) return null;
  if (!(await isPortalFeatureOn("battle"))) return null;
  const student = await prisma.student.findUnique({
    where: { userId: s.userId },
    select: {
      id: true,
      fullName: true,
      userId: true,
      enrollments: {
        where: { isActive: true },
        orderBy: { joinedAt: "desc" },
        select: { groupId: true },
        take: 1,
      },
    },
  });
  if (!student) return null;
  return { ...student, t: S(s.locale) };
}

const clampRounds = (score: unknown, total: unknown) => {
  const t = Math.min(MAX_ROUNDS, Math.max(0, Math.round(Number(total) || 0)));
  const sc = Math.min(t, Math.max(0, Math.round(Number(score) || 0)));
  return { score: sc, total: t };
};

export async function saveGameResult(input: {
  game: string;
  mode: string;
  score: number;
  total: number;
  won: boolean;
}): Promise<{ ok?: boolean; error?: string }> {
  const student = await me();
  if (!student) return { error: "forbidden" };

  const game = GAMES.includes(input.game) ? input.game : "vocabulary";
  const mode = MODES.includes(input.mode) ? input.mode : "ai";
  const { score, total } = clampRounds(input.score, input.total);
  if (total === 0) return { error: "invalid" };

  // Kunlik chegara — bitta o'yinni qayta-qayta o'ynab tanga yig'ib bo'lmasin
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const today = await prisma.gameResult.count({ where: { studentId: student.id, createdAt: { gte: dayStart } } });
  if (today >= MAX_PER_DAY) return { ok: true };

  await prisma.gameResult.create({
    data: { studentId: student.id, game, mode, score, total, won: !!input.won },
  });

  // Ko'nikma plitkasi: yaxshi o'ynalgan o'yin — har o'yin turiga KUNIGA BIR
  // marta (kalit tur+sana), aks holda bir o'yinni 20 marta o'ynab ball
  // yig'ib bo'lardi. Duel/guruhli o'yin ham shu yerdan o'tadi
  // (submitChallenge alohida bermaydi — bir o'yin ikki marta sanalmasin).
  if (score / total >= GAME_MIN_ACCURACY) {
    await awardSkill(student.id, game === "grammar" ? "gameGrammar" : "gameWords", `game:${game}:${dayKey(new Date())}`);
  }

  revalidatePath("/student", "layout");
  return { ok: true };
}

/* ══════════ Chaqiruvlar ══════════ */

/** Duel: guruhdoshga chaqiruv yuborish */
export async function createDuel(opponentId: string, lobby: string): Promise<{ id?: string; seed?: number; error?: string }> {
  const student = await me();
  if (!student) return { error: "forbidden" };
  if (opponentId === student.id) return { error: student.t.cantChallengeSelf };
  if (!GAMES.includes(lobby)) return { error: "invalid" };

  const groupId = student.enrollments[0]?.groupId;
  if (!groupId) return { error: student.t.notInGroup };

  // Faqat o'z guruhidagi, ilovaga ulangan o'quvchi
  const ok = await prisma.groupStudent.findFirst({
    where: { groupId, studentId: opponentId, isActive: true, student: { userId: { not: null } } },
    select: { id: true },
  });
  if (!ok) return { error: student.t.rivalNotInGroup };

  const expiresAt = new Date(Date.now() + CHALLENGE_DAYS * 864e5);
  const ch = await prisma.gameChallenge.create({
    data: {
      kind: "DUEL",
      lobby,
      seed: Math.floor(Math.random() * 1e9),
      createdById: student.id,
      opponentId,
      expiresAt,
    },
    select: { id: true, seed: true },
  });

  // Raqibga xabar — ilovada bildirishnoma bo'limida, RAQIBNING tilida
  const opp = await prisma.student.findUnique({ where: { id: opponentId }, select: { userId: true } });
  if (opp?.userId) {
    await notify({
      userId: opp.userId,
      event: "BATTLE",
      title: LT("duelInviteTitle"),
      body: LT("duelInviteBody", { name: student.fullName }),
      url: "/student/battle",
    });
  }

  revalidatePath("/student/battle");
  return { id: ch.id, seed: ch.seed };
}

/** Guruhli o'yin: shu haftalik chaqiruvni olish yoki yaratish */
export async function joinGroupGame(lobby: string): Promise<{ id?: string; seed?: number; error?: string }> {
  const student = await me();
  if (!student) return { error: "forbidden" };
  if (!GAMES.includes(lobby)) return { error: "invalid" };

  const groupId = student.enrollments[0]?.groupId;
  if (!groupId) return { error: student.t.notInGroup };

  // Guruhda shu o'yin turi bo'yicha ochiq chaqiruv bo'lsa — o'shanga qo'shiladi
  const open = await prisma.gameChallenge.findFirst({
    where: { kind: "GROUP", groupId, lobby, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, seed: true },
  });
  if (open) return { id: open.id, seed: open.seed };

  const ch = await prisma.gameChallenge.create({
    data: {
      kind: "GROUP",
      lobby,
      seed: Math.floor(Math.random() * 1e9),
      createdById: student.id,
      groupId,
      expiresAt: new Date(Date.now() + 7 * 864e5), // bir hafta ochiq turadi
    },
    select: { id: true, seed: true },
  });

  revalidatePath("/student/battle");
  return { id: ch.id, seed: ch.seed };
}

/** Chaqiruv natijasini yozish — har o'yinchi bir marta */
export async function submitChallenge(
  challengeId: string,
  score: number,
  total: number,
): Promise<{ ok?: boolean; error?: string }> {
  const student = await me();
  if (!student) return { error: "forbidden" };

  const ch = await prisma.gameChallenge.findUnique({
    where: { id: challengeId },
    select: { id: true, kind: true, createdById: true, opponentId: true, groupId: true, expiresAt: true, lobby: true },
  });
  if (!ch) return { error: student.t.challengeNotFound };
  if (ch.expiresAt < new Date()) return { error: student.t.challengeExpired };

  // Qatnashish huquqi
  const allowed =
    ch.kind === "DUEL"
      ? ch.createdById === student.id || ch.opponentId === student.id
      : !!ch.groupId && !!(await prisma.groupStudent.findFirst({
          where: { groupId: ch.groupId, studentId: student.id, isActive: true },
          select: { id: true },
        }));
  if (!allowed) return { error: student.t.challengeNotYours };

  const c = clampRounds(score, total);
  if (c.total === 0) return { error: "invalid" };

  const already = await prisma.gameChallengeEntry.findUnique({
    where: { challengeId_studentId: { challengeId: ch.id, studentId: student.id } },
    select: { id: true },
  });
  if (already) return { ok: true }; // ikkinchi marta o'ynash natijani o'zgartirmaydi

  await prisma.gameChallengeEntry.create({
    data: { challengeId: ch.id, studentId: student.id, score: c.score, total: c.total },
  });

  // Duelda ikkalasi ham tugatgan bo'lsa — ikkalasiga xabar
  if (ch.kind === "DUEL" && ch.opponentId) {
    const entries = await prisma.gameChallengeEntry.findMany({
      where: { challengeId: ch.id },
      select: { studentId: true, score: true },
    });
    if (entries.length === 2) {
      const rows = await prisma.student.findMany({
        where: { id: { in: [ch.createdById, ch.opponentId] } },
        select: { id: true, userId: true, fullName: true },
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      const [a, b] = entries;
      for (const e of entries) {
        const u = byId.get(e.studentId);
        if (!u?.userId) continue;
        const mineScore = e.score;
        const other = e.studentId === a.studentId ? b : a;
        const otherName = byId.get(other.studentId)?.fullName ?? LT("rival");
        const verdict = LT(mineScore > other.score ? "youWon" : mineScore < other.score ? "youLost" : "drawResult");
        // Har o'yinchiga O'Z tilida (notify oluvchining tilini o'zi tanlaydi)
        await notify({
          userId: u.userId,
          event: "BATTLE",
          title: LT("duelResultTitle", { verdict }),
          body: LT("duelResultBody", { a: mineScore, b: other.score, name: otherName }),
          url: "/student/battle",
        });
      }
    }
  }

  revalidatePath("/student/battle");
  revalidatePath("/student", "layout");
  return { ok: true };
}
