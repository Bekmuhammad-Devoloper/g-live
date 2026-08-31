import "server-only";
import { cache } from "react";
import { getSettings, setSetting } from "./settings";

// Ball qoidalari — o'quvchi nima uchun necha TANGA va necha YULDUZ oladi.
// Ikkalasi bir xil hodisalardan beriladi, farqi maqsadida:
//   tanga  — sarflanadi (Market'da sovg'aga almashtiriladi)
//   yulduz — sarflanmaydi, yig'ilib boradi (o'quvchining umumiy yutug'i)
// Direktor Sozlamalar > Ball va mukofotlar bo'limidan o'zgartiradi;
// qiymatlar Setting jadvalida "coin.*" va "star.*" kalitlari bilan saqlanadi.

export type PointKind = "coin" | "star";

export type CoinRuleKey =
  | "lesson"        // darsga qatnashgani (davomat)
  | "lessonView"    // dars videosini ko'rib chiqqani
  | "homework"      // vazifasi baholangani
  | "perfect"       // vazifani to'liq ballga bajargani (qo'shimcha)
  | "gameWin"       // o'yinda yutgani
  | "streak7"       // seriya to'lgani
  | "levelUp";      // yangi darajaga ko'tarilgani

export type CoinRules = Record<CoinRuleKey, number>;

export const COIN_DEFAULTS: CoinRules = {
  lesson: 5,
  lessonView: 3,
  homework: 10,
  perfect: 5,
  gameWin: 3,
  streak7: 15,
  levelUp: 50,
};

// Yulduz kamroq va "qadrliroq" — sonlar kichik
export const STAR_DEFAULTS: CoinRules = {
  lesson: 1,
  lessonView: 1,
  homework: 2,
  perfect: 1,
  gameWin: 1,
  streak7: 3,
  levelUp: 10,
};

export const COIN_RULE_KEYS = Object.keys(COIN_DEFAULTS) as CoinRuleKey[];

const DEFAULTS: Record<PointKind, CoinRules> = { coin: COIN_DEFAULTS, star: STAR_DEFAULTS };

// Bitta qiymat 0 dan 1000 gacha — tasodifan katta son kiritilmasin
const MAX = 1000;
const clean = (v: unknown, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= MAX ? n : dflt;
};

const key = (kind: PointKind, k: CoinRuleKey) => `${kind}.${k}`;

export const getPointRules = cache(async (kind: PointKind): Promise<CoinRules> => {
  const rows = await getSettings(COIN_RULE_KEYS.map((k) => key(kind, k)));
  const out = { ...DEFAULTS[kind] };
  for (const k of COIN_RULE_KEYS) {
    const raw = rows[key(kind, k)];
    if (raw !== undefined && raw !== "") out[k] = clean(raw, DEFAULTS[kind][k]);
  }
  return out;
});

export const getCoinRules = () => getPointRules("coin");
export const getStarRules = () => getPointRules("star");

export async function setPointRules(kind: PointKind, input: Partial<Record<CoinRuleKey, unknown>>): Promise<CoinRules> {
  const cur = await getPointRules(kind);
  const next = { ...cur };
  for (const k of COIN_RULE_KEYS) {
    if (input[k] === undefined) continue;
    next[k] = clean(input[k], cur[k]);
    await setSetting(key(kind, k), String(next[k]));
  }
  return next;
}
