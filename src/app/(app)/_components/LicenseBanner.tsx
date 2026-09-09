import Link from "next/link";
import { getSession } from "@/lib/auth";
import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "./Icon";

// Litsenziya (obuna) muddati banneri — Modme uslubida. Sahifalar tepasida ko'rsatiladi.
// Muddat .env dagi SUBSCRIPTION_UNTIL orqali sozlanadi.
// `locale` berilmasa sessiyadan olinadi — server komponent, ko'p sahifa propsiz chaqiradi.
export default async function LicenseBanner({ locale }: { locale?: Locale }) {
  const until = process.env.SUBSCRIPTION_UNTIL ?? null;
  if (!until) return null;

  const loc: Locale = locale ?? (await getSession())?.locale ?? "uz";
  const T = (uz: string, ru: string, en: string, de: string) => tr(loc, { uz, ru, en, de });

  const d = new Date(until);
  const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
  const p = (n: number) => String(n).padStart(2, "0");
  const date = `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
  const soon = daysLeft <= 7;

  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
        soon
          ? "border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <div className="flex items-center gap-2.5 text-sm">
        <Icon name="calendar" className={soon ? "h-5 w-5 text-amber-600" : "h-5 w-5 text-slate-400"} />
        <span className="text-slate-600 dark:text-slate-300">
          {T("Litsenziyaning platformaga amal qilish muddati:", "Срок действия лицензии на платформу:", "Platform licence valid until:", "Plattformlizenz gültig bis:")}{" "}
          <span className="font-semibold text-slate-800 dark:text-slate-100">{date} — 23:59</span>
        </span>
        <span className={`font-semibold ${soon ? "text-amber-700 dark:text-amber-400" : "text-slate-400"}`}>
          {daysLeft > 0
            ? soon
              ? T(`${daysLeft} kundan kam vaqt qoldi`, `Осталось менее ${daysLeft} дн.`, `Less than ${daysLeft} days left`, `Weniger als ${daysLeft} Tage übrig`)
              : T(`${daysLeft} kun qoldi`, `Осталось ${daysLeft} дн.`, `${daysLeft} days left`, `${daysLeft} Tage übrig`)
            : T("Muddat tugagan", "Срок истёк", "Expired", "Abgelaufen")}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/settings/billing" className="rounded-lg bg-slate-500 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-slate-600">
          {T("Batafsil", "Подробнее", "Details", "Details")}
        </Link>
        <Link href="/settings/billing" className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-600">
          {T("To'lash", "Оплатить", "Pay", "Bezahlen")}
        </Link>
      </div>
    </div>
  );
}
