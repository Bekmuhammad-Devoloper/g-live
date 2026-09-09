// Ko'nikma ballari — SOF hisob (bazasiz), sinovdan o'tkazsa bo'ladi.
//
// Qoidalar:
//   · Ball 0..100 oralig'ida.
//   · Pasayish: ilova ochilmagan HAR TO'LIQ KUN uchun `rate` ball. Bir kun
//     kirilmasa — bir marta, ikki kun — ikki marta. Bugun kirilgan bo'lsa —
//     to'liq kun o'tmagan, pasaymaydi.
//   · Pasayish qaytmaydi: o'quvchi qaytganida ball avvalgi holiga sakrab
//     chiqmaydi, faqat yangi mashq bilan o'sadi.
//   · `decayedAt` — qaysi vaqtgacha pasayish qo'llangani. Shu bo'lmasa
//     sahifa har ochilganda o'sha kunlar uchun qayta-qayta ayirilardi.

export const SKILL_KINDS = ["words", "reading", "listening", "speaking"] as const;
export type SkillKind = (typeof SKILL_KINDS)[number];
export type SkillScores = Record<SkillKind, number>;

export const DAY_MS = 24 * 60 * 60 * 1000;

export const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Qo'llanmagan pasayish kunlari soni va yangi `decayedAt`.
 *
 * Hisob `lastActiveAt` va `decayedAt` ning kattasidan boshlanadi: oxirgi
 * faollikdan keyin o'tgan to'liq kunlar, lekin allaqachon ayirilganlari
 * emas.
 */
export function pendingDecayDays(lastActiveAt: Date, decayedAt: Date, now: Date): { days: number; decayedThrough: Date } {
  const start = Math.max(lastActiveAt.getTime(), decayedAt.getTime());
  const days = Math.max(0, Math.floor((now.getTime() - start) / DAY_MS));
  return { days, decayedThrough: new Date(start + days * DAY_MS) };
}

/** Ballardan `days * rate` ayiradi (0 dan pastga tushmaydi) */
export function applyDecay(scores: SkillScores, days: number, rate: number): SkillScores {
  if (days <= 0 || rate <= 0) return { ...scores };
  const out = { ...scores };
  for (const k of SKILL_KINDS) out[k] = clampScore(out[k] - days * rate);
  return out;
}

/** Ball qo'shadi (100 dan oshmaydi) */
export function addPoints(scores: SkillScores, kind: SkillKind, points: number): SkillScores {
  return { ...scores, [kind]: clampScore(scores[kind] + points) };
}

/**
 * Qaysi mashq qaysi ko'nikmaga necha ball beradi.
 *
 * Kalit — hodisa turi; har biri o'quvchida BIR MARTA beriladi (SkillEvent
 * unique key), shu sabab qiymatlar "bitta dars uchun" degan ma'noda.
 * O'nta dars to'liq o'tilsa har ko'nikma ~100 ga yetadi.
 */
export const SKILL_POINTS = {
  /** Lug'at 1-bosqich (tanish) — bitta dars */
  vocabStage1: { kind: "words" as const, points: 6 },
  /** Lug'at 2-bosqich (teskari) */
  vocabStage2: { kind: "words" as const, points: 6 },
  /** Lug'at 3-bosqich (harflardan yig'ish) — yozma tiklash, o'qishga yaqin */
  vocabStage3: { kind: "reading" as const, points: 6 },
  /** Lug'at 4-bosqich (talaffuz) — bitta dars */
  vocabStage4: { kind: "speaking" as const, points: 8 },
  /** Bitta so'zni to'g'ri aytgani */
  sayWord: { kind: "speaking" as const, points: 1 },
  /** Dars videosini ko'rgani */
  lessonView: { kind: "listening" as const, points: 10 },
  /** Vazifa baholangani */
  homework: { kind: "reading" as const, points: 8 },
  /** Vazifa to'liq ballga */
  homeworkPerfect: { kind: "reading" as const, points: 4 },
  /** So'z jangi: lug'at / so'z o'yini / krossvord — har o'yin turiga kuniga bir */
  gameWords: { kind: "words" as const, points: 4 },
  /** So'z jangi: grammatika (der/die/das) — kuniga bir */
  gameGrammar: { kind: "reading" as const, points: 4 },
} as const;

/** So'z jangi natijasi shu ulushdan past bo'lsa ball berilmaydi (to'g'ri/jami) */
export const GAME_MIN_ACCURACY = 0.7;

/** Kunlik kalit uchun mahalliy sana (server TZ=Asia/Tashkent) */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export type SkillEventType = keyof typeof SKILL_POINTS;
