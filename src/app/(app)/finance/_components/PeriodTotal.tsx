"use client";

import DateInput from "@/app/(app)/_components/DateInput";
import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";
import { fmtDate } from "./Pagination";

// "To'lovlar miqdori" kartasi + Sanadan/Sanagacha filtri (URL ?from=&to= orqali serverga uzatiladi).
export default function PeriodTotal({ total, from, to, locale }: { total: number; from: string; to: string; locale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const [pending, start] = useTransition();

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const qs = new URLSearchParams();
    if (f) qs.set("from", f);
    if (t) qs.set("to", t);
    start(() => router.push(`${pathname}?${qs.toString()}`));
  };

  const inp = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-400 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr] lg:items-end">
      <div className="rounded-2xl border border-l-4 border-slate-300 border-l-brand-600 bg-white p-5 shadow-card dark:border-slate-600 dark:border-l-brand-500 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg text-slate-600 dark:text-slate-300">
              {tr(locale, { uz: "To'lovlar miqdori", ru: "Сумма платежей", en: "Payments amount", de: "Zahlungsbetrag" })}:{" "}
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatMoney(total, locale)}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400"><Icon name="calendar" className="h-3.5 w-3.5" /> {fmtDate(from)} — {fmtDate(to)}</div>
          </div>
          <Icon name="coins" className="h-7 w-7 shrink-0 text-brand-400" />
        </div>
      </div>
      <form onSubmit={apply} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Sanadan", ru: "С даты", en: "From date", de: "Ab Datum" })}</label>
          <DateInput value={f} onChange={(e) => setF(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Sanagacha", ru: "По дату", en: "To date", de: "Bis Datum" })}</label>
          <DateInput value={t} onChange={(e) => setT(e.target.value)} className={inp} />
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={pending} className="h-11 rounded-full bg-brand-800 px-8 text-sm font-semibold text-white transition hover:bg-brand-900 disabled:opacity-60">
            {pending ? "..." : tr(locale, { uz: "Filtr", ru: "Фильтр", en: "Filter", de: "Filtern" })}
          </button>
        </div>
      </form>
    </div>
  );
}
