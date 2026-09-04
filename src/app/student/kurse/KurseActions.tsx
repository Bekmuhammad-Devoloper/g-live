import Link from "next/link";
import type { StudentStrings } from "../_i18n";
import { TEAL } from "../_ui";

// Kurse sahifasi sarlavhasidagi ikki tugma: lug'at va ustozga yozish
// (seriya/qo'ng'iroq o'rniga — bu yerda shular kerakroq).

// Shisha tugma — PageHeader'dagi orqaga tugmasi bilan bir xil o'lchov va uslub
const BTN =
  "gl-glass grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:translate-y-[1px]";

// O'chirilgan bo'lim tugmasi ko'rinmaydi — aks holda bosilganda sahifa
// /student ga qaytarib yuboradi va "ochilmayapti" degan taassurot qoladi.
export default function KurseActions({ t, showDict = true, showTeacher = true }: { t: StudentStrings; showDict?: boolean; showTeacher?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {showDict && (
      <Link href="/student/worterbuch" aria-label={t.dictionary} title={t.dictionary} className={BTN}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5.2A1.7 1.7 0 0 1 5.7 3.5h4.6A1.7 1.7 0 0 1 12 5.2v14a1.4 1.4 0 0 0-1.4-1.3H5.7A1.7 1.7 0 0 1 4 16.2V5.2Z" />
          <path d="M20 5.2a1.7 1.7 0 0 0-1.7-1.7h-4.6A1.7 1.7 0 0 0 12 5.2v14a1.4 1.4 0 0 1 1.4-1.3h4.9A1.7 1.7 0 0 0 20 16.2V5.2Z" />
          <path d="M6.4 7.4h3.1M6.4 10.2h3.1M14.5 7.4h3.1M14.5 10.2h3.1" strokeWidth="1.6" />
        </svg>
      </Link>
      )}
      {showTeacher && (
      <Link href="/student/lehrer" aria-label={t.writeTeacher} title={t.writeTeacher} className={BTN}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.5 12.4c0 3.9-3.8 7-8.5 7-.9 0-1.8-.1-2.6-.3l-4.6 1.5 1.5-3.7c-1.4-1.2-2.3-2.8-2.3-4.5 0-3.9 3.8-7 8-7s8.5 3.1 8.5 7Z" />
          <path d="M8.8 12h6.4M8.8 9.2h4.3" strokeWidth="1.7" />
        </svg>
      </Link>
      )}
    </div>
  );
}
