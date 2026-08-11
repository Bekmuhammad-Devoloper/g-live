import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import ConversionReport from "./ConversionReport";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ROP, ROLES.MANAGER, ROLES.ADMIN];

const p2 = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// Konversiya hisobotlari — ma'lumot alohida API'dan (/api/reports/conversion) olinadi.
export default async function ConversionPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim sotuv bo'limi uchun.", ru: "Этот раздел предназначен для отдела продаж.", en: "This section is for the sales department." })} />;
  }

  const now = new Date();
  const defaultFrom = isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultTo = isoDay(now);

  return <ConversionReport defaultFrom={defaultFrom} defaultTo={defaultTo} locale={s.locale} />;
}
