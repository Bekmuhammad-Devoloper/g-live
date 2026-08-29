import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import { getSettings } from "@/lib/settings";
import TelephonyView from "./TelephonyView";

const ALLOWED = [ROLES.DIRECTOR, ROLES.ADMIN];

export default async function TelephonyPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Telefoniya sozlamalari faqat direktor va administrator uchun.", ru: "Настройки телефонии доступны только директору и администратору.", en: "Telephony settings are available only to the director and administrator.", de: "Die Telefonie-Einstellungen stehen nur dem Direktor und dem Administrator zur Verfügung." })} />;
  }

  const cfg = await getSettings(["telephony.domain", "telephony.apiKey", "telephony.enabled"]);
  const apiKey = cfg["telephony.apiKey"] ?? "";

  return (
    <TelephonyView
      locale={s.locale}
      domain={cfg["telephony.domain"] ?? ""}
      hasKey={apiKey.length > 0}
      keyHint={apiKey ? `${apiKey.slice(0, 6)}…` : ""}
      enabled={cfg["telephony.enabled"] === "1"}
    />
  );
}

export const dynamic = "force-dynamic";
