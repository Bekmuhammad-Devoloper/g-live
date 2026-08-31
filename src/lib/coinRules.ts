import "server-only";
import { cache } from "react";
import { getSettings, setSetting } from "./settings";

// Tanga qoidalari — o'quvchi nima uchun necha tanga oladi.
// Direktor Sozlamalar > Tanga qoidalari bo'limidan o'zgartiradi;
// qiymatlar Setting jadvalida "coin.*" kalitlari bilan saqlanadi.

export type CoinRuleKey =
  | "lesson"        // darsga qatnashgani
  | "homework"      // vazifasi baholangani
  | "perfect"       // vazifani to'liq ballga bajargani (qo'shimcha)
  | "gameWin"       // o'yinda yutgani
  | "streak7"       // ketma-ket 7 dars qoldirmagani
  | "levelUp";      // yangi darajaga ko'tarilgani

export type CoinRules = Record<CoinRuleKey, number>;

export const COIN_DEFAULTS: CoinRules = {
  lesson: 5,
  homework: 10,
  perfect: 5,
  gameWin: 3,
  streak7: 15,
  levelUp: 50,
};

export const COIN_RULE_KEYS = Object.keys(COIN_DEFAULTS) as CoinRuleKey[];

// Bitta tanga 0 dan 1000 gacha — tasodifan katta son kiritilmasin
const MAX = 1000;
const clean = (v: unknown, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= MAX ? n : dflt;
};

const key = (k: CoinRuleKey) => `coin.${k}`;

export const getCoinRules = cache(async (): Promise<CoinRules> => {
  const rows = await getSettings(COIN_RULE_KEYS.map(key));
  const out = { ...COIN_DEFAULTS };
  for (const k of COIN_RULE_KEYS) {
    const raw = rows[key(k)];
    if (raw !== undefined && raw !== "") out[k] = clean(raw, COIN_DEFAULTS[k]);
  }
  return out;
});

export async function setCoinRules(input: Partial<Record<CoinRuleKey, unknown>>): Promise<CoinRules> {
  const cur = await getCoinRules();
  const next = { ...cur };
  for (const k of COIN_RULE_KEYS) {
    if (input[k] === undefined) continue;
    next[k] = clean(input[k], cur[k]);
    await setSetting(key(k), String(next[k]));
  }
  return next;
}
