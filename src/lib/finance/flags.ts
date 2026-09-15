import "server-only";

import { getSettings } from "@/lib/settings";
import { FINANCE_SETTING_KEYS, FINANCE_V2_DEFAULT_CUTOVER_ISO } from "./constants";
import { isTashkentMonthStart } from "./period";

// Finance V2 feature flag va cutover.
//
// Flag default O'CHIQ: `Setting finance.v2.enabled` aynan "true" bo'lmaguncha
// prod xatti-harakati o'zgarmaydi (S14). Cutover — moliyaviy faktlar (earning,
// assignment KNOWN) shu lahzadan boshlab yoziladi; oldingi davr legacy (S1).

export interface FinanceFlags {
  enabled: boolean;
  cutoverAt: Date;
}

export function parseFinanceFlags(settings: Record<string, string | undefined>): FinanceFlags {
  const enabled = settings[FINANCE_SETTING_KEYS.enabled] === "true";
  const raw = settings[FINANCE_SETTING_KEYS.cutoverAt] ?? FINANCE_V2_DEFAULT_CUTOVER_ISO;
  const parsed = new Date(raw);
  // Cutover faqat Tashkent OY BOSHI bo'lishi mumkin (R11). Buzuq yoki oy o'rtasidagi
  // qiymat — masalan "2026-10-01" (UTC yarim tun = 05:00 Tashkent) yoki offset'siz
  // "2026-10-01T00:00:00" (jarayon TZ'siga bog'liq) — tasdiqlangan standartga qaytadi;
  // xato bilan to'xtash o'rniga eski davr moliyasiga tasodifan V2 qoidasi qo'llanmasin.
  const valid = !Number.isNaN(parsed.getTime()) && isTashkentMonthStart(parsed);
  const cutoverAt = valid ? parsed : new Date(FINANCE_V2_DEFAULT_CUTOVER_ISO);
  return { enabled, cutoverAt };
}

export async function getFinanceFlags(): Promise<FinanceFlags> {
  const settings = await getSettings([FINANCE_SETTING_KEYS.enabled, FINANCE_SETTING_KEYS.cutoverAt]);
  return parseFinanceFlags(settings);
}

export async function isFinanceV2Enabled(): Promise<boolean> {
  return (await getFinanceFlags()).enabled;
}

/** Lahza cutover'dan keyinmi (teng bo'lsa ham — cutover 00:00 dan boshlanadi) */
export function isAfterCutover(at: Date, flags: Pick<FinanceFlags, "cutoverAt">): boolean {
  return at.getTime() >= flags.cutoverAt.getTime();
}
