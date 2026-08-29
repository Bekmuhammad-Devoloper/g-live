"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { exportRows } from "@/lib/export";
import { Icon } from "../../_components/Icon";

export interface VBalanceStaff {
  id: string; name: string; phone: string | null; fiksa: number;
  records: { y: number; m: number; bonus: number; penalty: number }[];
}

const monthIdx = (isoDate: string) => {
  const [y, m] = isoDate.split("-").map(Number);
  return y * 12 + (m - 1);
};

export default function BalanceView({ staff, defaultFrom, defaultTo, locale }: { staff: VBalanceStaff[]; defaultFrom: string; defaultTo: string; locale: Locale }) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const fi = monthIdx(from), ti = monthIdx(to);
    return staff.map((st) => {
      let bonus = 0, penalty = 0;
      for (const r of st.records) { const idx = r.y * 12 + (r.m - 1); if (idx >= fi && idx <= ti) { bonus += r.bonus; penalty += r.penalty; } }
      return { id: st.id, name: st.name, phone: st.phone, ishHaqi: st.fiksa, bonus, avans: 0, jarima: penalty, jami: st.fiksa + bonus - penalty };
    });
  }, [staff, from, to]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const cur = Math.min(page, totalPages);
  const shown = rows.slice((cur - 1) * pageSize, cur * pageSize);

  const totals = rows.reduce((a, r) => ({ ishHaqi: a.ishHaqi + r.ishHaqi, bonus: a.bonus + r.bonus, avans: a.avans + r.avans, jarima: a.jarima + r.jarima }), { ishHaqi: 0, bonus: 0, avans: 0, jarima: 0 });

  const doExport = () => {
    exportRows(
      `balans_${from}_${to}`,
      [
        { key: "n", label: "№" },
        { key: "name", label: tr(locale, { uz: "To'liq ismi", ru: "Полное имя", en: "Full name", de: "Vollständiger Name" }) },
        { key: "phone", label: tr(locale, { uz: "Telefon raqam", ru: "Номер телефона", en: "Phone number", de: "Telefonnummer" }) },
        { key: "ishHaqi", label: tr(locale, { uz: "Ish haqi", ru: "Зарплата", en: "Salary", de: "Gehalt" }) },
        { key: "bonus", label: tr(locale, { uz: "Bonus", ru: "Бонус", en: "Bonus", de: "Bonus" }) },
        { key: "avans", label: tr(locale, { uz: "Avans", ru: "Аванс", en: "Advance", de: "Vorschuss" }) },
        { key: "jarima", label: tr(locale, { uz: "Jarima", ru: "Штраф", en: "Penalty", de: "Strafe" }) },
        { key: "jami", label: tr(locale, { uz: "Jami", ru: "Итого", en: "Total", de: "Gesamt" }) },
      ],
      rows.map((r, i) => ({ n: i + 1, name: r.name, phone: r.phone ?? "", ishHaqi: r.ishHaqi, bonus: r.bonus, avans: r.avans, jarima: r.jarima, jami: r.jami })),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Balans", ru: "Баланс", en: "Balance", de: "Saldo" })}</h1>
        <div className="flex flex-wrap items-center gap-3">
        {/* Sana oralig'i */}
        <div className="flex h-11 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
          <Icon name="calendar" className="h-4 w-4 shrink-0 text-slate-400" />
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-[120px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
          <span className="text-slate-300">–</span>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-[120px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
          <button onClick={() => { setFrom(defaultFrom); setTo(defaultTo); }} className="ml-1 text-slate-400 hover:text-slate-600" title={tr(locale, { uz: "Tozalash", ru: "Очистить", en: "Clear", de: "Zurücksetzen" })}><Icon name="refresh" className="h-4 w-4" /></button>
        </div>
        <button onClick={doExport} disabled={rows.length === 0} className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
          <Icon name="download" className="h-4 w-4" />
          {tr(locale, { uz: "Eksport", ru: "Экспорт", en: "Export", de: "Exportieren" })}
        </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="w-12 px-4 py-3">№</th><th className="px-4 py-3">{tr(locale, { uz: "To'liq ismi", ru: "Полное имя", en: "Full name", de: "Vollständiger Name" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Telefon raqam", ru: "Номер телефона", en: "Phone number", de: "Telefonnummer" })}</th>
                <th className="px-4 py-3 text-right">{tr(locale, { uz: "Ish haqi", ru: "Зарплата", en: "Salary", de: "Gehalt" })}</th><th className="px-4 py-3 text-right">{tr(locale, { uz: "Bonus", ru: "Бонус", en: "Bonus", de: "Bonus" })}</th><th className="px-4 py-3 text-right">{tr(locale, { uz: "Avans", ru: "Аванс", en: "Advance", de: "Vorschuss" })}</th><th className="px-4 py-3 text-right">{tr(locale, { uz: "Jarima", ru: "Штраф", en: "Penalty", de: "Strafe" })}</th><th className="px-4 py-3 text-right">{tr(locale, { uz: "Jami", ru: "Итого", en: "Total", de: "Gesamt" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {shown.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi", ru: "Данные не найдены", en: "No data found", de: "Keine Daten gefunden" })}</td></tr>
              ) : shown.map((r, i) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-400">{(cur - 1) * pageSize + i + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{r.name}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">{formatMoney(r.ishHaqi, locale)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{r.bonus ? "+" + formatMoney(r.bonus, locale) : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">{r.avans ? formatMoney(r.avans, locale) : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-rose-500">{r.jarima ? "−" + formatMoney(r.jarima, locale) : "—"}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900 dark:text-white">{formatMoney(r.jami, locale)}</td>
                </tr>
              ))}
            </tbody>
            {shown.length > 0 && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-800/40">
                <tr className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  <td className="px-4 py-3" colSpan={3}>{tr(locale, { uz: "Jami", ru: "Итого", en: "Total", de: "Gesamt" })}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totals.ishHaqi, locale)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{formatMoney(totals.bonus, locale)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totals.avans, locale)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-rose-500">{formatMoney(totals.jarima, locale)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totals.ishHaqi + totals.bonus - totals.jarima, locale)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 text-sm">
              <PageBtn disabled={cur <= 1} onClick={() => setPage(cur - 1)}>‹</PageBtn>
              <span className="px-2 text-xs text-slate-500 dark:text-slate-400">{cur} / {totalPages}</span>
              <PageBtn disabled={cur >= totalPages} onClick={() => setPage(cur + 1)}>›</PageBtn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PageBtn({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return <button onClick={onClick} disabled={disabled} className={cn("flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800")}>{children}</button>;
}
