"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { writeAudit } from "@/lib/audit";
import { COIN_RULE_KEYS, setCoinRules, type CoinRules } from "@/lib/coinRules";

// Tanga qoidalari — rahbariyat belgilaydi
const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];

export type CoinState = { ok?: boolean; error?: string };

export async function saveCoinRules(input: Record<string, number>): Promise<CoinState> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "Ruxsat yo'q" };

  const patch: Partial<Record<keyof CoinRules, unknown>> = {};
  for (const k of COIN_RULE_KEYS) {
    if (input[k] === undefined) continue;
    const n = Number(input[k]);
    if (!Number.isFinite(n) || n < 0 || n > 1000) return { error: "Qiymat 0 dan 1000 gacha bo'lishi kerak" };
    patch[k] = n;
  }

  const saved = await setCoinRules(patch);
  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "CoinRules",
    newValue: saved,
    reason: "Tanga qoidalari o'zgartirildi",
  });

  // Balanslar qoidadan qayta hisoblanadi — o'quvchi portali ham yangilansin
  revalidatePath("/settings/coins");
  revalidatePath("/student", "layout");
  return { ok: true };
}
