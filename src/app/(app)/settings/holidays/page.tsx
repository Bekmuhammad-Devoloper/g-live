import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import HolidaysView from "./HolidaysView";

const ALLOWED = [ROLES.DIRECTOR, ROLES.ADMIN];

export default async function HolidaysPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Sozlamalar faqat direktor va administrator uchun.", ru: "Настройки доступны только директору и администратору.", en: "Settings are available only to the director and administrator.", de: "Einstellungen sind nur für Direktor und Administrator verfügbar." })} />;
  }
  return <HolidaysView locale={s.locale} />;
}
