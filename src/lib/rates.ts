// Valyuta kurslari — O'zbekiston Markaziy banki (cbu.uz) ochiq API'sidan.
// MB kursi ish kunida bir marta yangilanadi, shuning uchun 30 daqiqada bir tekshiramiz.
// Tashqi API javob bermasa — oxirgi muvaffaqiyatli qiymat qaytariladi (stale: true):
//   1) shu jarayon xotirasi  2) Setting jadvali (server qayta ishga tushsa ham kurs turaveradi).

import { getSetting, setSetting } from "./settings";

export const RATE_CODES = ["USD", "EUR"] as const;
export type RateCode = (typeof RATE_CODES)[number];

export interface Rate {
  ccy: RateCode;
  rate: number; // 1 birlik = necha so'm
  diff: number; // kechagi kursga nisbatan farq (so'm)
  date: string; // MB e'lon qilgan sana, "DD.MM.YYYY"
}

export interface RatesPayload {
  rates: Rate[];
  fetchedAt: string; // ISO — cbu.uz dan oxirgi muvaffaqiyatli olingan payt
  stale: boolean; // true → cbu.uz javob bermadi, eski qiymat ko'rsatilyapti
}

const CBU_URL = "https://cbu.uz/uz/arkhiv-kursov-valyut/json/";
const SETTING_KEY = "rates.cbu";
const TTL_MS = 30 * 60_000; // muvaffaqiyatli javobdan keyin
const RETRY_MS = 5 * 60_000; // xatodan keyin — tezroq qayta urinamiz
const TIMEOUT_MS = 6_000; // cbu.uz sekin bo'lsa sahifa kutib qolmasin

let cache: { data: RatesPayload; nextTryAt: number } | null = null;
let inflight: Promise<RatesPayload | null> | null = null;

function num(v: unknown): number {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** cbu.uz javobidan faqat bizga kerakli valyutalarni ajratib olamiz. */
function parseCbu(raw: unknown): Rate[] {
  if (!Array.isArray(raw)) return [];
  const out: Rate[] = [];
  for (const code of RATE_CODES) {
    const row = raw.find((r) => r && typeof r === "object" && (r as { Ccy?: string }).Ccy === code) as
      | { Rate?: string; Diff?: string; Date?: string; Nominal?: string }
      | undefined;
    if (!row) continue;
    const nominal = num(row.Nominal) || 1;
    const rate = num(row.Rate) / nominal;
    if (rate <= 0) continue;
    out.push({ ccy: code, rate, diff: num(row.Diff) / nominal, date: String(row.Date ?? "") });
  }
  return out;
}

async function fetchCbu(): Promise<Rate[] | null> {
  try {
    const res = await fetch(CBU_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const rates = parseCbu(await res.json());
    return rates.length ? rates : null;
  } catch {
    return null;
  }
}

/** DB'dagi oxirgi saqlangan kurs (server qayta ishga tushganda ishlatiladi). */
async function loadFromDb(): Promise<RatesPayload | null> {
  try {
    const raw = await getSetting(SETTING_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as RatesPayload;
    if (!Array.isArray(saved.rates) || saved.rates.length === 0) return null;
    return { rates: saved.rates, fetchedAt: saved.fetchedAt, stale: true };
  } catch {
    return null;
  }
}

async function load(now: number): Promise<RatesPayload | null> {
  const fresh = await fetchCbu();

  if (fresh) {
    const data: RatesPayload = { rates: fresh, fetchedAt: new Date(now).toISOString(), stale: false };
    cache = { data, nextTryAt: now + TTL_MS };
    try {
      await setSetting(SETTING_KEY, JSON.stringify(data));
    } catch {
      // DB yozuvi ixtiyoriy — kurs baribir xotirada bor
    }
    return data;
  }

  // cbu.uz javob bermadi → oxirgi ma'lum qiymatni "eskirgan" deb qaytaramiz
  const last = cache?.data ?? (await loadFromDb());
  if (!last) return null;
  const data: RatesPayload = { ...last, stale: true };
  cache = { data, nextTryAt: now + RETRY_MS };
  return data;
}

/** Joriy USD va EUR kurslari. Bir vaqtda kelgan so'rovlar bitta fetch'ni baham ko'radi. */
export async function getRates(): Promise<RatesPayload | null> {
  const now = Date.now();
  if (cache && now < cache.nextTryAt) return cache.data;
  if (inflight) return inflight;
  inflight = load(now).finally(() => {
    inflight = null;
  });
  return inflight;
}
