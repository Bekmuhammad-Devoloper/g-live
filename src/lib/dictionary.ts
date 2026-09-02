import "server-only";
import data from "@/data/dict-de-uz.json";

// Nemischa-o'zbekcha lug'at (bosma nashrdan raqamlashtirilgan, ~6200 so'z).
// Maydonlar qisqartirilgan — fayl hajmi kichik bo'lishi uchun:
//   de — nemischa so'z, g — rod (m/f/n/pl), p — so'z turkumi,
//   f — grammatik shakl, s — soha (zool., bot. ...), uz — tarjima, l — harf.

export type DictEntry = {
  de: string;
  g: "m" | "f" | "n" | "pl" | null;
  p: string | null;
  f: string | null;
  s: string | null;
  uz: string;
  l: string;
};

const ALL = data as DictEntry[];

export const DICT_SIZE = ALL.length;
export const DICT_LETTERS = [...new Set(ALL.map((e) => e.l))].sort();

// Qidiruv uchun oldindan tayyorlangan kichik harfli nusxa (har so'rovda qayta hisoblanmasin)
const INDEX = ALL.map((e) => ({ de: e.de.toLowerCase(), uz: e.uz.toLowerCase() }));

export type DictQuery = { q?: string; letter?: string; limit?: number };

export function searchDict({ q = "", letter = "", limit = 60 }: DictQuery) {
  const needle = q.trim().toLowerCase();
  const L = letter.trim().toUpperCase();

  const hits: { e: DictEntry; rank: number }[] = [];
  for (let i = 0; i < ALL.length; i++) {
    const e = ALL[i];
    if (L && e.l !== L) continue;
    if (!needle) {
      hits.push({ e, rank: 3 });
      continue;
    }
    const de = INDEX[i].de;
    // Aniq moslik → so'z boshi → ichida → tarjimada: shu tartibda chiqadi
    const rank = de === needle ? 0 : de.startsWith(needle) ? 1 : de.includes(needle) ? 2 : INDEX[i].uz.includes(needle) ? 3 : -1;
    if (rank >= 0) hits.push({ e, rank });
  }

  if (needle) hits.sort((a, b) => a.rank - b.rank || a.e.de.localeCompare(b.e.de, "de"));
  return { total: hits.length, items: hits.slice(0, limit).map((h) => h.e) };
}

// Artikl — o'quvchi rodni yodda saqlashi uchun eng foydali ma'lumot
export const ARTICLE: Record<string, string> = { m: "der", f: "die", n: "das", pl: "die" };

export const POS_LABEL: Record<string, string> = {
  vt: "fe'l",
  vi: "fe'l",
  adj: "sifat",
  adv: "ravish",
  num: "son",
  pron: "olmosh",
  präp: "predlog",
  konj: "bog'lovchi",
  int: "undov",
};

// ── Bitta so'zni topish ──
// Kurs darslaridagi so'zlar ("das Haus", "guten Tag") shu baza bilan
// bog'lanadi: o'quvchi ustoz tarjima yozmagan bo'lsa ham ma'nosini ko'radi.

const BY_KEY = new Map<string, DictEntry>();
for (const e of ALL) {
  const k = e.de.toLowerCase();
  if (!BY_KEY.has(k)) BY_KEY.set(k, e);
}

const ARTICLES = new Set(["der", "die", "das", "ein", "eine", "einen", "dem", "den"]);

export function lookup(word: string): DictEntry | null {
  const w = word.trim().toLowerCase().replace(/[.,;:!?]+$/, "");
  if (!w) return null;

  const direct = BY_KEY.get(w);
  if (direct) return direct;

  const parts = w.split(/\s+/);
  if (parts.length > 1) {
    // "das Haus" -> "haus"
    if (ARTICLES.has(parts[0])) {
      const rest = BY_KEY.get(parts.slice(1).join(" "));
      if (rest) return rest;
      const one = BY_KEY.get(parts[1]);
      if (one) return one;
    }
    // "guten Tag" -> asosiy ot odatda oxirida
    const last = BY_KEY.get(parts[parts.length - 1]);
    if (last) return last;
  }
  return null;
}

// ── "Jang" o'yinlari uchun so'z tanlash ──
// O'yinga har so'z ham to'g'ri kelmaydi: qo'shma iboralar, juda qisqa yoki
// juda uzun so'zlar, tarjimasi bo'sh yozuvlar chiqarib tashlanadi.

const clean = (e: DictEntry) =>
  !e.de.includes(" ") &&
  e.de.length >= 3 &&
  e.de.length <= 12 &&
  /^[A-Za-zÄÖÜäöüß-]+$/.test(e.de) &&
  e.uz.trim().length >= 2;

// Tarjimadagi qavs ichidagi izoh va sinonimlar olib tashlanadi —
// savolda faqat asosiy ma'no ko'rinsin
export const shortUz = (uz: string) =>
  uz.replace(/\([^)]*\)/g, "").split(/[,;]/)[0].trim().slice(0, 60);

const GAME_POOL = ALL.filter(clean);

/** O'yin uchun tasodifiy so'zlar (nemischa + o'zbekcha) */
export function gameWords(limit = 200): { de: string; uz: string }[] {
  const pool = [...GAME_POOL];
  const out: { de: string; uz: string }[] = [];
  for (let i = 0; i < limit && pool.length; i++) {
    const k = Math.floor(Math.random() * pool.length);
    const e = pool.splice(k, 1)[0];
    out.push({ de: e.de, uz: shortUz(e.uz) });
  }
  return out;
}

/** Grammatika o'yini uchun — rodi aniq otlar (der / die / das) */
export function genderNouns(limit = 200): { de: string; uz: string; g: string }[] {
  const pool = GAME_POOL.filter((e) => e.g === "m" || e.g === "f" || e.g === "n");
  const out: { de: string; uz: string; g: string }[] = [];
  const used = new Set<number>();
  for (let i = 0; i < limit && used.size < pool.length; i++) {
    let k = Math.floor(Math.random() * pool.length);
    while (used.has(k)) k = (k + 1) % pool.length;
    used.add(k);
    const e = pool[k];
    out.push({ de: e.de, uz: shortUz(e.uz), g: e.g! });
  }
  return out;
}
