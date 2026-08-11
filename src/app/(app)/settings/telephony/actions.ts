"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { getSetting, setSetting } from "@/lib/settings";
import { writeAudit } from "@/lib/audit";

const ALLOWED = [ROLES.DIRECTOR, ROLES.ADMIN];
export type State = { ok?: boolean; error?: string };

export async function saveTelephony(fd: FormData): Promise<State> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "Ruxsat yo'q" };

  const domain = String(fd.get("domain") || "").trim();
  const apiKey = String(fd.get("apiKey") || "").trim();
  const enabled = String(fd.get("enabled") || "") === "1";

  if (domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) return { error: "Domen noto'g'ri (masalan: pbx00000.onpbx.ru)" };

  await setSetting("telephony.provider", "onlinepbx");
  await setSetting("telephony.domain", domain);
  await setSetting("telephony.enabled", enabled ? "1" : "0");
  if (apiKey) await setSetting("telephony.apiKey", apiKey); // faqat yangi kiritilganda yangilanadi

  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Setting", entityId: "telephony", newValue: { domain, enabled } });
  revalidatePath("/settings/telephony");
  return { ok: true };
}

// Kiritilgan ma'lumotlar formatini tekshirish (haqiqiy ulanish OnlinePBX hisobiga bog'liq)
export async function checkTelephony(): Promise<{ ok: boolean; message: string }> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { ok: false, message: "Ruxsat yo'q" };
  const [domain, apiKey] = await Promise.all([getSetting("telephony.domain"), getSetting("telephony.apiKey")]);
  if (!domain) return { ok: false, message: "Domen kiritilmagan" };
  if (!apiKey) return { ok: false, message: "API kalit kiritilmagan" };
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) return { ok: false, message: "Domen formati noto'g'ri" };
  if (apiKey.length < 8) return { ok: false, message: "API kalit juda qisqa" };
  return { ok: true, message: "Ma'lumotlar to'g'ri kiritilgan. Ulanish OnlinePBX hisobingizga bog'liq." };
}
