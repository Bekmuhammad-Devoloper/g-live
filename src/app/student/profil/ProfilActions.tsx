import Link from "next/link";
import type { StudentStrings } from "../_i18n";
import { TEAL } from "../_ui";

// Profil sarlavhasidagi ikki tugma: sozlamalar va market
// (seriya/qo'ng'iroq o'rniga — bu bo'limda shular kerakroq).

const BTN =
  "gl-glass grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:translate-y-[1px]";

// Market o'chirilgan bo'lsa tugma ko'rinmaydi (bosilganda /student ga
// qaytarib yuborishdan ko'ra umuman ko'rsatmagan tushunarli).
export default function ProfilActions({ t, showMarket = true }: { t: StudentStrings; showMarket?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {showMarket && (
      <Link href="/student/market" aria-label={t.market} title={t.market} className={BTN}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5.6 8.4h12.8l-1 10.2a1.6 1.6 0 0 1-1.6 1.4H8.2a1.6 1.6 0 0 1-1.6-1.4L5.6 8.4Z" />
          <path d="M9 10.2V7.3a3 3 0 0 1 6 0v2.9" />
        </svg>
      </Link>
      )}
      <Link href="/student/einstellungen" aria-label={t.settings} title={t.settings} className={BTN}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3.1" />
          <path d="M19.2 14.2a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4v.2a1.8 1.8 0 1 1-3.6 0v-.1a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-.9h-.2a1.8 1.8 0 1 1 0-3.6h.1a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 1.7.3h.1a1.5 1.5 0 0 0 .9-1.4v-.2a1.8 1.8 0 1 1 3.6 0v.1a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0-.3 1.7v.1a1.5 1.5 0 0 0 1.4.9h.2a1.8 1.8 0 1 1 0 3.6h-.1a1.5 1.5 0 0 0-1.4.9Z" />
        </svg>
      </Link>
    </div>
  );
}
