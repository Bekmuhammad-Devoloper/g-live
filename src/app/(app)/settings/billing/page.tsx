import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { Forbidden } from "../../_components/ui";
import LicenseBanner from "../../_components/LicenseBanner";
import BillingSettings from "../BillingSettings";

const ALLOWED = [ROLES.DIRECTOR, ROLES.ADMIN];

// Billing — platforma uchun to'lov (tarif rejalari + to'lov tarixi). Mustaqil sahifa.
export default async function BillingPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title="Kirish taqiqlangan" body="Bu bo'lim rahbariyat uchun." />;
  }

  return (
    <div>
      <LicenseBanner />
      <BillingSettings locale={s.locale} />
    </div>
  );
}
