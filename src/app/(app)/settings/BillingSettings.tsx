"use client";

import { useEffect, useMemo, useState } from "react";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";

const STORAGE_KEY = "gl-billing-history";

const PLANS = [
  { name: "START", monthly: 500000 },
  { name: "BASIC", monthly: 1040000 },
  { name: "PRO", monthly: 1560000 },
  { name: "PREMIUM", monthly: 3000000 },
];
const PERIODS = [
  { months: 3, off: 0, bonus: 0 },
  { months: 6, off: 0.1, bonus: 1 },
  { months: 9, off: 0.1, bonus: 1 },
  { months: 12, off: 0.1, bonus: 2 },
];

const fmt = (n: number) => new Intl.NumberFormat("ru-RU").format(n);
const priceOf = (monthly: number, months: number, off: number) => Math.round(monthly * months * (1 - off));

interface Paid { plan: string; months: number; amount: number; date: string }

export default function BillingSettings({ locale }: { locale: Locale }) {
  const [sel, setSel] = useState(""); // "PLAN|months"
  const [history, setHistory] = useState<Paid[]>([]);
  const [msg, setMsg] = useState(false);

  const monthWord = tr(locale, { uz: "oy", ru: "мес.", en: "mo", de: "Mo." });
  const sumWord = tr(locale, { uz: "so'm", ru: "сум", en: "so'm", de: "UZS" });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const options = useMemo(() =>
    PLANS.flatMap((p) => PERIODS.map((pr) => ({
      value: `${p.name}|${pr.months}`,
      label: `${p.name} · ${pr.months} ${monthWord} — ${fmt(priceOf(p.monthly, pr.months, pr.off))} ${sumWord}`,
      plan: p.name, months: pr.months, amount: priceOf(p.monthly, pr.months, pr.off),
    }))), [monthWord, sumWord]);

  const pay = () => {
    const opt = options.find((o) => o.value === sel);
    if (!opt) return;
    const now = new Date();
    const p2 = (n: number) => String(n).padStart(2, "0");
    const entry: Paid = { plan: opt.plan, months: opt.months, amount: opt.amount, date: `${p2(now.getDate())}.${p2(now.getMonth() + 1)}.${now.getFullYear()}` };
    const next = [entry, ...history];
    setHistory(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setMsg(true); setTimeout(() => setMsg(false), 2500);
    setSel("");
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Chap: to'lov formasi */}
        <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-card dark:border-slate-600 dark:bg-slate-900">
          <h2 className="mb-5 text-xl font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Platforma uchun to'lov", ru: "Оплата платформы", en: "Platform payment", de: "Zahlung für die Plattform" })}</h2>
          <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">{tr(locale, { uz: "Davr", ru: "Период", en: "Period", de: "Zeitraum" })} <span className="text-rose-500">*</span></label>
          <div className="relative">
            <select value={sel} onChange={(e) => setSel(e.target.value)}
              className="h-11 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3.5 pr-9 text-sm text-slate-700 outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100">
              <option value="">{tr(locale, { uz: "Tanlang", ru: "Выберите", en: "Select", de: "Auswählen" })}</option>
              {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">▾</span>
          </div>

          <button onClick={pay} disabled={!sel}
            className="mt-5 rounded-full bg-sky-500 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:opacity-50">
            {tr(locale, { uz: "To'lash", ru: "Оплатить", en: "Pay", de: "Bezahlen" })}
          </button>
          {msg && <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{tr(locale, { uz: "✓ To'lov qabul qilindi (demo) — tarixga qo'shildi.", ru: "✓ Платёж принят (демо) — добавлен в историю.", en: "✓ Payment accepted (demo) — added to history.", de: "✓ Zahlung angenommen (Demo) — zur Historie hinzugefügt." })}</p>}
        </div>

        {/* O'ng: tarif rejalari */}
        <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-card dark:border-slate-600 dark:bg-slate-900">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {PLANS.map((p) => (
              <div key={p.name} className="overflow-hidden rounded-lg border-2 border-[#0f172a]">
                <div className="bg-[#ffffff] py-1.5 text-center text-base font-extrabold tracking-tight text-[#0f172a]">{p.name}</div>
                <div className="space-y-1 bg-[#ffffff] p-1">
                  {PERIODS.map((pr) => {
                    const orig = p.monthly * pr.months;
                    const final = priceOf(p.monthly, pr.months, pr.off);
                    return (
                      <div key={pr.months} className="flex items-stretch gap-1">
                        <div className="flex w-8 shrink-0 items-center justify-center rounded bg-[#0f172a] text-[9px] font-bold leading-tight text-white">{pr.months}<br />{tr(locale, { uz: "OY", ru: "МЕС", en: "MO", de: "MO" })}</div>
                        <div className="relative flex-1 rounded bg-amber-400 px-1 py-1 text-center leading-tight">
                          {pr.off > 0 && <div className="text-[8px] text-[#64748b] line-through">{fmt(orig)}</div>}
                          <div className="text-[11px] font-bold text-[#0f172a]">{fmt(final)}</div>
                          {pr.bonus > 0 && (
                            <span className="absolute -bottom-1 -right-1 rounded-full border border-[#0f172a] bg-[#ffffff] px-1 text-[7px] font-bold text-[#0f172a]">+{pr.bonus} {tr(locale, { uz: "OY", ru: "МЕС", en: "MO", de: "MO" })}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between px-1 text-sm">
            <span className="font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Germaniya <span className="text-brand-600">Live</span></span>
            <span className="text-slate-500 dark:text-slate-400">Gamification <span className="font-semibold text-amber-500">500 000</span> {sumWord}</span>
          </div>
        </div>
      </div>

      {/* To'lov tarixi */}
      <div>
        <h3 className="mb-3 text-xl font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "To'lov tarixi", ru: "История платежей", en: "Payment history", de: "Zahlungsverlauf" })}</h3>
        <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-card dark:border-slate-600 dark:bg-slate-900">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-300 text-[13px] font-semibold text-slate-600 dark:border-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-5 py-3.5">{tr(locale, { uz: "Jami", ru: "Итого", en: "Total", de: "Gesamt" })}</th>
                <th className="px-5 py-3.5">{tr(locale, { uz: "Tarif", ru: "Тариф", en: "Plan", de: "Tarif" })}</th>
                <th className="px-5 py-3.5">{tr(locale, { uz: "Sana", ru: "Дата", en: "Date", de: "Datum" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {history.length === 0 ? (
                <tr><td colSpan={3} className="px-5 py-10 text-center text-slate-400">{tr(locale, { uz: "To'lov tarixi bo'sh", ru: "История платежей пуста", en: "Payment history is empty", de: "Zahlungsverlauf ist leer" })}</td></tr>
              ) : (
                history.map((h, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 font-semibold text-slate-800 dark:text-slate-100">{fmt(h.amount)} {sumWord}</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{h.plan} · {h.months} {monthWord}</td>
                    <td className="px-5 py-3 text-slate-500">{h.date}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}
