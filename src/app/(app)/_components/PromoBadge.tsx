import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";

/** To'lov qatoridagi promokod belgisi: "Promokod 2KURS · −50 000". Server va klient komponentlarida ishlaydi. */
export default function PromoBadge({ code, discount, locale, className = "" }: {
  code: string | null | undefined;
  discount?: number | null;
  locale: Locale;
  className?: string;
}) {
  if (!code) return null;
  const sum = (discount ?? 0).toLocaleString("ru-RU").replace(/,/g, " ");
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30 ${className}`}
      title={tr(locale, { uz: "Promokod bilan to'langan", ru: "Оплачено с промокодом", en: "Paid with promo code", de: "Mit Promo-Code bezahlt" })}
    >
      {tr(locale, { uz: "Promokod", ru: "Промокод", en: "Promo", de: "Promo" })} {code}
      {discount ? <span className="font-bold">· −{sum}</span> : null}
    </span>
  );
}

/** Matn ko'rinishi (CSV eksport, qisqa satrlar uchun) */
export function promoText(code: string | null | undefined, discount: number | null | undefined, locale: Locale): string {
  if (!code) return "";
  const sum = (discount ?? 0).toLocaleString("ru-RU").replace(/,/g, " ");
  return `${tr(locale, { uz: "Promokod", ru: "Промокод", en: "Promo", de: "Promo" })} ${code}${discount ? ` (−${sum})` : ""}`;
}
