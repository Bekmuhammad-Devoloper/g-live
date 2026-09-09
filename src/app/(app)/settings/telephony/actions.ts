"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { tr } from "@/lib/tr";
import { ROLES } from "@/lib/constants";
import { getSetting, setSetting } from "@/lib/settings";
import { writeAudit } from "@/lib/audit";

const ALLOWED = [ROLES.DIRECTOR, ROLES.ADMIN];
export type State = { ok?: boolean; error?: string };

export async function saveTelephony(fd: FormData): Promise<State> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };

  const domain = String(fd.get("domain") || "").trim();
  const apiKey = String(fd.get("apiKey") || "").trim();
  const enabled = String(fd.get("enabled") || "") === "1";

  if (domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) return { error: tr(s.locale, { uz: "Domen noto'g'ri (masalan: pbx00000.onpbx.ru)", ru: "Неверный домен (например: pbx00000.onpbx.ru)", en: "Invalid domain (e.g. pbx00000.onpbx.ru)", de: "Ungültige Domain (z. B. pbx00000.onpbx.ru)" }) };

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
  if (!ALLOWED.includes(s.role as never)) return { ok: false, message: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };
  const [domain, apiKey] = await Promise.all([getSetting("telephony.domain"), getSetting("telephony.apiKey")]);
  if (!domain) return { ok: false, message: tr(s.locale, { uz: "Domen kiritilmagan", ru: "Домен не указан", en: "Domain not set", de: "Domain nicht angegeben" }) };
  if (!apiKey) return { ok: false, message: tr(s.locale, { uz: "API kalit kiritilmagan", ru: "API-ключ не указан", en: "API key not set", de: "API-Schlüssel nicht angegeben" }) };
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) return { ok: false, message: tr(s.locale, { uz: "Domen formati noto'g'ri", ru: "Неверный формат домена", en: "Invalid domain format", de: "Ungültiges Domainformat" }) };
  if (apiKey.length < 8) return { ok: false, message: tr(s.locale, { uz: "API kalit juda qisqa", ru: "API-ключ слишком короткий", en: "API key is too short", de: "API-Schlüssel ist zu kurz" }) };
  return { ok: true, message: tr(s.locale, { uz: "Ma'lumotlar to'g'ri kiritilgan. Ulanish OnlinePBX hisobingizga bog'liq.", ru: "Данные введены верно. Подключение зависит от вашего аккаунта OnlinePBX.", en: "Details look correct. The connection depends on your OnlinePBX account.", de: "Die Angaben sind korrekt. Die Verbindung hängt von Ihrem OnlinePBX-Konto ab." }) };
}
