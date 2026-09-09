import "server-only";
import { prisma } from "./db";
import { getProgressRules } from "./progressRules";
import {
  addPoints, applyDecay, pendingDecayDays, SKILL_KINDS, SKILL_POINTS,
  type SkillEventType, type SkillKind, type SkillScores,
} from "./skillMath";

// Ko'nikma ballari — bazaga yozish/o'qish. Sof hisob lib/skillMath.ts da.
//
// Uch kirish nuqtasi:
//   · touchActivity — ilova ochilganda (student/layout). Pasayishni qo'llab,
//     "oxirgi faollik"ni yangilaydi. Yozuv soatiga bir marta — har so'rovda
//     bazaga yozmaslik uchun.
//   · awardSkill    — mashq bajarilganda. Kalit bo'yicha bir marta.
//   · getSkills     — bosh sahifa o'qiydi (pasayishni ham qo'llaydi).

const TOUCH_THROTTLE_MS = 60 * 60 * 1000;

type Row = {
  id: string; words: number; reading: number; listening: number; speaking: number;
  lastActiveAt: Date; decayedAt: Date;
};

const scoresOf = (r: Row): SkillScores => ({ words: r.words, reading: r.reading, listening: r.listening, speaking: r.speaking });
const EMPTY: SkillScores = { words: 0, reading: 0, listening: 0, speaking: 0 };

async function rowFor(studentId: string): Promise<Row> {
  return prisma.studentSkill.upsert({
    where: { studentId },
    create: { studentId },
    update: {},
    select: { id: true, words: true, reading: true, listening: true, speaking: true, lastActiveAt: true, decayedAt: true },
  });
}

/**
 * Qo'llanmagan pasayishni bazaga yozadi. Qaytgani — yangilangan ballar.
 * Faollik bo'lmagan kunlar bo'lmasa hech narsa yozmaydi.
 */
async function settleDecay(row: Row, now: Date): Promise<SkillScores> {
  const { skillDecayPerDay } = await getProgressRules();
  const { days, decayedThrough } = pendingDecayDays(row.lastActiveAt, row.decayedAt, now);
  const cur = scoresOf(row);
  if (days <= 0 || skillDecayPerDay <= 0) return cur;

  const next = applyDecay(cur, days, skillDecayPerDay);
  await prisma.studentSkill.update({
    where: { id: row.id },
    data: { ...next, decayedAt: decayedThrough },
  });
  return next;
}

/** Ilova ochildi — pasayishni qo'llab, faollikni belgilaymiz (soatiga bir yozuv) */
export async function touchActivity(studentId: string): Promise<void> {
  try {
    const now = new Date();
    const row = await rowFor(studentId);
    await settleDecay(row, now);
    if (now.getTime() - row.lastActiveAt.getTime() >= TOUCH_THROTTLE_MS) {
      await prisma.studentSkill.update({ where: { id: row.id }, data: { lastActiveAt: now } });
    }
  } catch (e) {
    // Ko'nikma hisobi sahifani yiqitmasin
    console.warn("[skills] touch:", e instanceof Error ? e.message : e);
  }
}

/** Bosh sahifa uchun — hozirgi ballar (pasayish qo'llangan holda) */
export async function getSkills(studentId: string): Promise<SkillScores> {
  try {
    const row = await rowFor(studentId);
    return await settleDecay(row, new Date());
  } catch (e) {
    console.warn("[skills] read:", e instanceof Error ? e.message : e);
    return EMPTY;
  }
}

/**
 * Mashq bajarildi — ball beriladi. `key` bo'yicha BIR MARTA: xuddi shu
 * mashqni qayta bajarib ball yig'ib bo'lmaydi. Faollik ham belgilanadi.
 *
 * Hech qachon istisno ko'tarmaydi: ball berilmagani uchun mashqning o'zi
 * bekor bo'lib qolmasligi kerak.
 */
export async function awardSkill(studentId: string, type: SkillEventType, key: string): Promise<boolean> {
  const { kind, points } = SKILL_POINTS[type];
  try {
    const now = new Date();
    const row = await rowFor(studentId);
    const settled = await settleDecay(row, now);

    // Hodisa allaqachon bo'lganmi — unique kalit
    try {
      await prisma.skillEvent.create({ data: { skillId: row.id, key, kind, points } });
    } catch {
      // P2002 — bor. Faollikni baribir belgilaymiz.
      await prisma.studentSkill.update({ where: { id: row.id }, data: { lastActiveAt: now } });
      return false;
    }

    const next = addPoints(settled, kind, points);
    await prisma.studentSkill.update({
      where: { id: row.id },
      data: { ...next, lastActiveAt: now },
    });
    return true;
  } catch (e) {
    console.warn("[skills] award:", type, key, e instanceof Error ? e.message : e);
    return false;
  }
}

export { SKILL_KINDS, SKILL_POINTS };
export type { SkillKind, SkillScores };
