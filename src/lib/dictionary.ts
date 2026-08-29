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
