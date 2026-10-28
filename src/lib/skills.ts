import "server-only";
import { prisma } from "./db";
import { getProgressRules } from "./progressRules";
import {
  addPoints, applyDecay, pendingDecayDays, SKILL_KINDS, SKILL_POINTS,
  type SkillEventType, type SkillKind, type SkillScores,
} from "./skillMath";

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

export async function touchActivity(studentId: string): Promise<void> {
  try {
    const now = new Date();
    const row = await rowFor(studentId);
    await settleDecay(row, now);
    if (now.getTime() - row.lastActiveAt.getTime() >= TOUCH_THROTTLE_MS) {
      await prisma.studentSkill.update({ where: { id: row.id }, data: { lastActiveAt: now } });
    }
  } catch (e) {
    console.warn("[skills] touch:", e instanceof Error ? e.message : e);
  }
}

export async function getSkills(studentId: string): Promise<SkillScores> {
  try {
    const row = await rowFor(studentId);
    return await settleDecay(row, new Date());
  } catch (e) {
    console.warn("[skills] read:", e instanceof Error ? e.message : e);
    return EMPTY;
  }
}

export async function awardSkill(studentId: string, type: SkillEventType, key: string): Promise<boolean> {
  const { kind, points } = SKILL_POINTS[type];
  try {
    const now = new Date();
    const row = await rowFor(studentId);
    const settled = await settleDecay(row, now);

    const dup = await prisma.skillEvent.findUnique({ where: { skillId_key: { skillId: row.id, key } }, select: { id: true } });
    if (!dup) {
      try {
        await prisma.skillEvent.create({ data: { skillId: row.id, key, kind, points } });
      } catch {
        await prisma.studentSkill.update({ where: { id: row.id }, data: { lastActiveAt: now } });
        return false;
      }
    } else {
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
