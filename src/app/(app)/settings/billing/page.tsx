import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import LicenseBanner from "../../_components/LicenseBanner";
import BillingSettings from "../BillingSettings";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR];

// Billing — platforma uchun to'lov (tarif rejalari + to'lov tarixi). Mustaqil sahifa.
export default async function BillingPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim rahbariyat uchun.", ru: "Этот раздел только для руководства.", en: "This section is for management only.", de: "Dieser Bereich ist nur für die Geschäftsleitung." })} />;
  }

  return (
    <div>
      <LicenseBanner locale={s.locale} />
      <BillingSettings locale={s.locale} />
    </div>
  );
}
