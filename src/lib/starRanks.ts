import "server-only";
import { cache } from "react";
import { prisma } from "./db";
import { tr } from "./tr";
import type { Locale } from "./constants";

// Yulduz darajalari — o'quvchi yulduz yig'ib ko'tariladigan pog'onalar.
//
// Kurs darajasi (A1/A2 — StudyLevel) bilan ADASHTIRMASLIK kerak: u qaysi
// kitobni o'qiyotganini bildiradi, bu esa qancha mehnat qilganini. Nomlar
// nemis tiliga bog'liq: o'quvchi "Anfänger"dan "Profi"gacha ko'tariladi.
//
// Pog'onaga chiqqani uchun tanga beriladi. Tanga hech qayerda saqlanmaydi —
// yulduz soniga qarab qayta hisoblanadi, shu sabab qoida o'zgarsa balans
// ham darhol o'zgaradi (loyihaning umumiy tamoyili).
//
// Boshqaruvi: Sozlamalar > Yulduz darajalari (direktor va menejer).

export type StarRankRow = {
  id: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  nameDe: string;
  stars: number;
  reward: number;
  color: string;
  /** Ma'muriyat yuklagan belgi; bo'lmasa pog'ona raqami ko'rsatiladi */
  iconUrl: string | null;
  isActive: boolean;
};

const SELECT = {
  id: true, nameUz: true, nameRu: true, nameEn: true, nameDe: true,
  stars: true, reward: true, color: true, iconUrl: true, isActive: true,
} as const;

// Birinchi ishga tushirishda quyiladigan pog'onalar. Birinchisi 0 yulduz —
// har bir o'quvchi darhol biror darajada turadi, bo'sh joy ko'rinmaydi.
const DEFAULTS = [
  { nameUz: "Yangi boshlovchi", nameRu: "Новичок", nameEn: "Newcomer", nameDe: "Neuling", stars: 0, reward: 0, color: "#64748b" },
  { nameUz: "Boshlovchi", nameRu: "Начинающий", nameEn: "Beginner", nameDe: "Anfänger", stars: 10, reward: 20, color: "#0ea5e9" },
  { nameUz: "O'rganuvchi", nameRu: "Ученик", nameEn: "Learner", nameDe: "Lerner", stars: 25, reward: 30, color: "#0e7490" },
  { nameUz: "Suhbatdosh", nameRu: "Собеседник", nameEn: "Speaker", nameDe: "Sprecher", stars: 50, reward: 50, color: "#6366f1" },
  { nameUz: "Bilimdon", nameRu: "Знаток", nameEn: "Connoisseur", nameDe: "Kenner", stars: 90, reward: 75, color: "#a855f7" },
  { nameUz: "Mahoratli", nameRu: "Умелец", nameEn: "Skilled", nameDe: "Könner", stars: 150, reward: 100, color: "#ec4899" },
  { nameUz: "Ustoz", nameRu: "Мастер", nameEn: "Master", nameDe: "Meister", stars: 240, reward: 150, color: "#f97316" },
  { nameUz: "Zabardast", nameRu: "Профи", nameEn: "Pro", nameDe: "Profi", stars: 360, reward: 200, color: "#eab308" },
];

async function seedIfEmpty(): Promise<void> {
  if ((await prisma.starRank.count()) > 0) return;
  await prisma.starRank.createMany({ data: DEFAULTS });
}

/** Barcha pog'onalar (o'chirilganlari ham) — CRM ro'yxati uchun */
export const getStarRanks = cache(async (): Promise<StarRankRow[]> => {
  await seedIfEmpty();
  return prisma.starRank.findMany({ orderBy: [{ stars: "asc" }], select: SELECT });
});

/** Ilovada ko'rinadiganlari */
export const getActiveStarRanks = cache(async (): Promise<StarRankRow[]> =>
  (await getStarRanks()).filter((r) => r.isActive));

export function rankName(r: StarRankRow, locale: Locale): string {
  return tr(locale, { uz: r.nameUz, ru: r.nameRu, en: r.nameEn, de: r.nameDe });
}

export type StarProgress = {
  /** Hozirgi pog'ona (ro'yxat bo'sh bo'lsa null) */
  current: StarRankRow | null;
  /** Keyingi pog'ona — eng yuqorisida turgan bo'lsa null */
  next: StarRankRow | null;
  /** Nechanchi pog'ona (1 dan boshlab; pog'ona yo'q bo'lsa 0) */
  place: number;
  /** Jami pog'onalar soni */
  total: number;
  /** Keyingisiga qancha yulduz qolgan */
  need: number;
  /** Shu pog'ona ichidagi yo'l, 0..100 */
  pct: number;
};

/**
 * Yulduz soniga qarab pog'ona. Chegarasi yulduzdan KATTA bo'lmagan
 * pog'onalarning eng yuqorisi olinadi.
 */
export function progressOf(ranks: StarRankRow[], stars: number): StarProgress {
  const list = [...ranks].sort((a, b) => a.stars - b.stars);
  let i = -1;
  for (let k = 0; k < list.length; k++) if (stars >= list[k].stars) i = k;

  const current = i >= 0 ? list[i] : null;
  const next = i + 1 < list.length ? list[i + 1] : null;
  const from = current?.stars ?? 0;
  const need = next ? Math.max(0, next.stars - stars) : 0;
  const span = next ? Math.max(1, next.stars - from) : 1;

  return {
    current,
    next,
    place: i + 1,
    total: list.length,
    need,
    pct: next ? Math.max(0, Math.min(100, Math.round(((stars - from) / span) * 100))) : 100,
  };
}

/** Chiqilgan pog'onalar soni — birinchisi (kirish darajasi) sanalmaydi */
export function ranksGained(ranks: StarRankRow[], stars: number): number {
  return Math.max(0, progressOf(ranks, stars).place - 1);
}

/** Chiqilgan pog'onalar uchun jami tanga */
export function rankReward(ranks: StarRankRow[], stars: number): number {
  const list = [...ranks].sort((a, b) => a.stars - b.stars);
  let sum = 0;
  // Birinchi pog'ona kirish darajasi — u uchun mukofot berilmaydi
  for (let k = 1; k < list.length; k++) if (stars >= list[k].stars) sum += list[k].reward;
  return sum;
}
