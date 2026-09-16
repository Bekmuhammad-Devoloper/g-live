import "server-only";

import { getSettings } from "@/lib/settings";
import { FINANCE_SETTING_KEYS } from "./constants";
import { parseCutoverAt } from "./cutover";

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
  // Cutover faqat Tashkent OY BOSHI bo'lishi mumkin (R11) — buzuq qiymat standartga qaytadi (cutover.ts)
  const cutoverAt = parseCutoverAt(settings[FINANCE_SETTING_KEYS.cutoverAt]);
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
