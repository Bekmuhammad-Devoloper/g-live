"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { isPortalFeatureOn } from "@/lib/portalFeatures";

// O'yin natijasini saqlash — yutuq uchun tanga shu yozuvlardan hisoblanadi.
// Ballni mijoz yuboradi, shu sabab cheklovlar shu yerda: raund soni
// belgilangan chegaradan oshmaydi va bir kunda sanaladigan o'yin soni cheklangan.

const GAMES = ["vocabulary", "wordgame", "crossword", "grammar"];
const MODES = ["ai", "duel", "group"];
const MAX_ROUNDS = 30;
const MAX_PER_DAY = 20; // kuniga shuncha o'yin yoziladi, ortig'i saqlanmaydi

export async function saveGameResult(input: {
  game: string;
  mode: string;
  score: number;
  total: number;
  won: boolean;
}): Promise<{ ok?: boolean; error?: string }> {
  const s = await getSession();
  if (!s || s.role !== ROLES.STUDENT) return { error: "forbidden" };
  if (!(await isPortalFeatureOn("battle"))) return { error: "forbidden" };

  const student = await prisma.student.findUnique({ where: { userId: s.userId }, select: { id: true } });
  if (!student) return { error: "forbidden" };

  const game = GAMES.includes(input.game) ? input.game : "vocabulary";
  const mode = MODES.includes(input.mode) ? input.mode : "ai";
  const total = Math.min(MAX_ROUNDS, Math.max(0, Math.round(Number(input.total) || 0)));
  const score = Math.min(total, Math.max(0, Math.round(Number(input.score) || 0)));
  if (total === 0) return { error: "invalid" };

  // Kunlik chegara — bitta o'yinni qayta-qayta o'ynab tanga yig'ib bo'lmasin
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const today = await prisma.gameResult.count({ where: { studentId: student.id, createdAt: { gte: dayStart } } });
  if (today >= MAX_PER_DAY) return { ok: true };

  await prisma.gameResult.create({
    data: { studentId: student.id, game, mode, score, total, won: !!input.won },
  });

  revalidatePath("/student", "layout");
  return { ok: true };
}
