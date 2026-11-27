"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";

const STORAGE_KEY = "gl-billing-history";

const PLANS = [
  { name: "START", monthly: 350000 },
  { name: "STANDART", monthly: 890000 },
  { name: "PRO", monthly: 1410000 },
  { name: "PREMIUM", monthly: 2850000 },
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
  const [sel, setSel] = useState("");
  const [history, setHistory] = useState<Paid[]>([]);
  const [msg, setMsg] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(null);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const i = PLANS.findIndex((p) => p.name === zoom);
        const d = e.key === "ArrowRight" ? 1 : -1;
        setZoom(PLANS[(i + d + PLANS.length) % PLANS.length].name);
      }
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [zoom]);

  const monthWord = tr(locale, { uz: "oy", ru: "мес.", en: "mo", de: "Mo." });
  const sumWord = tr(locale, { uz: "so'm", ru: "сум", en: "so'm", de: "UZS" });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch { }
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
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { }
    setMsg(true); setTimeout(() => setMsg(false), 2500);
    setSel("");
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
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

        <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-card dark:border-slate-600 dark:bg-slate-900">
          <div className="grid grid-cols-2 gap-3 min-[1400px]:grid-cols-4">
            {PLANS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setZoom(p.name)}
                title={tr(locale, { uz: "Kattalashtirish", ru: "Увеличить", en: "Enlarge", de: "Vergrößern" })}
                className="group overflow-hidden rounded-xl border-2 border-[#0f172a] bg-[#ffffff] text-left transition hover:-translate-y-0.5 hover:shadow-pop focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <div className="flex items-center justify-center gap-1.5 py-2 text-lg font-extrabold tracking-tight text-[#0f172a]">
                  {p.name}
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[#64748b] opacity-0 transition group-hover:opacity-100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
                </div>
                <div className="space-y-1.5 px-1.5 pb-2">
                  {PERIODS.map((pr) => {
                    const orig = p.monthly * pr.months;
                    const final = priceOf(p.monthly, pr.months, pr.off);
                    return (
                      <div key={pr.months} className="flex items-stretch gap-1.5">
                        <div className="flex w-10 shrink-0 flex-col items-center justify-center rounded-md bg-[#0f172a] py-1 text-[13px] font-extrabold leading-none text-white">
                          {pr.months}
                          <span className="mt-0.5 text-[9px] font-bold">{tr(locale, { uz: "OY", ru: "МЕС", en: "MO", de: "MO" })}</span>
                          {pr.bonus > 0 && (
                            <span title={`+${pr.bonus} ${tr(locale, { uz: "oy bonus", ru: "мес. в подарок", en: "bonus months", de: "Bonusmonate" })}`}
                              className="mt-1 rounded-full bg-amber-400 px-1 text-[9px] font-extrabold leading-[13px] text-[#0f172a]">+{pr.bonus}</span>
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col justify-center rounded-md bg-amber-400 px-1 py-1 text-center leading-tight">
                          {pr.off > 0 && <div className="whitespace-nowrap text-[11px] font-semibold text-[#475569] line-through">{fmt(orig)}</div>}
                          <div className="whitespace-nowrap text-[14px] font-extrabold tabular-nums text-[#0f172a]">{fmt(final)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between px-1 text-sm">
            <span className="font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Germaniya <span className="text-brand-600">Live</span></span>
            <span className="text-slate-500 dark:text-slate-400">Gamification <span className="font-semibold text-amber-500">500 000</span> {sumWord}</span>
          </div>
        </div>
      </div>

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
      {zoom && createPortal(
        <PlanZoom
          plan={PLANS.find((p) => p.name === zoom) ?? PLANS[0]}
          locale={locale}
          sumWord={sumWord}
          selected={sel}
          onClose={() => setZoom(null)}
          onStep={(d) => {
            const i = PLANS.findIndex((p) => p.name === zoom);
            setZoom(PLANS[(i + d + PLANS.length) % PLANS.length].name);
          }}
          onPick={(value) => { setSel(value); setZoom(null); }}
        />,
        document.body,
      )}
    </div>
  );
}

function PlanZoom({ plan, locale, sumWord, selected, onClose, onStep, onPick }: {
  plan: { name: string; monthly: number };
  locale: Locale;
  sumWord: string;
  selected: string;
  onClose: () => void;
  onStep: (d: number) => void;
  onPick: (value: string) => void;
}) {
  const oy = tr(locale, { uz: "oy", ru: "мес.", en: "months", de: "Monate" });
  const perMonth = tr(locale, { uz: "oyiga", ru: "в месяц", en: "per month", de: "pro Monat" });
  const bonusWord = tr(locale, { uz: "oy bonus", ru: "мес. в подарок", en: "bonus months", de: "Bonusmonate" });
  const totalWord = tr(locale, { uz: "Jami muddat", ru: "Итого срок", en: "Total term", de: "Gesamtlaufzeit" });
  const saveWord = tr(locale, { uz: "Tejaysiz", ru: "Экономия", en: "You save", de: "Ersparnis" });
  const pickWord = tr(locale, { uz: "Tanlash", ru: "Выбрать", en: "Choose", de: "Auswählen" });
  const pickedWord = tr(locale, { uz: "Tanlangan", ru: "Выбрано", en: "Selected", de: "Ausgewählt" });
  const navBtn = "flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={plan.name}
        className="relative max-h-full w-full max-w-5xl overflow-y-auto rounded-3xl border-2 border-[#0f172a] bg-white p-5 shadow-2xl sm:p-8 dark:border-slate-600 dark:bg-slate-800"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-4xl font-black tracking-tight text-[#0f172a] sm:text-5xl dark:text-white">{plan.name}</div>
            <div className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
              {fmt(plan.monthly)} {sumWord} / {tr(locale, { uz: "oy", ru: "мес.", en: "month", de: "Monat" })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onStep(-1)} className={navBtn} aria-label="prev">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <button type="button" onClick={() => onStep(1)} className={navBtn} aria-label="next">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
            <button type="button" onClick={onClose} aria-label="close" className={navBtn}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PERIODS.map((pr) => {
            const orig = plan.monthly * pr.months;
            const final = priceOf(plan.monthly, pr.months, pr.off);
            const total = pr.months + pr.bonus;
            const value = `${plan.name}|${pr.months}`;
            const active = selected === value;
            return (
              <div key={pr.months}
                className={`flex flex-col overflow-hidden rounded-2xl border-2 bg-[#0f172a] ${active ? "border-emerald-500 ring-4 ring-emerald-200" : "border-[#0f172a]"}`}>
                <div className="flex items-baseline justify-center gap-1.5 bg-[#0f172a] py-3 text-white">
                  <span className="text-3xl font-black leading-none">{pr.months}</span>
                  <span className="text-sm font-bold uppercase">{oy}</span>
                </div>
                <div className="flex flex-1 flex-col items-center gap-1 bg-amber-400 px-3 py-5 text-center">
                  {pr.off > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-[#475569] line-through">{fmt(orig)}</span>
                      <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-extrabold text-white">−{Math.round(pr.off * 100)}%</span>
                    </div>
                  ) : (
                    <div className="h-6" />
                  )}
                  <div className="text-[28px] font-black leading-tight tabular-nums text-[#0f172a]">{fmt(final)}</div>
                  <div className="text-sm font-bold text-[#0f172a]">{sumWord}</div>
                  <div className="mt-2 text-[13px] font-semibold text-[#334155]">
                    ≈ {fmt(Math.round(final / total))} {sumWord} {perMonth}
                  </div>
                </div>
                <div className="space-y-1.5 bg-[#ffffff] px-3 py-3 text-[13px] text-[#334155]">
                  <div className="flex items-center justify-between">
                    <span>{totalWord}</span>
                    <span className="font-extrabold text-[#0f172a]">{total} {oy}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{tr(locale, { uz: "Bonus", ru: "Бонус", en: "Bonus", de: "Bonus" })}</span>
                    <span className={`font-extrabold ${pr.bonus > 0 ? "text-emerald-600" : "text-[#94a3b8]"}`}>{pr.bonus > 0 ? `+${pr.bonus} ${bonusWord}` : "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{saveWord}</span>
                    <span className={`font-extrabold ${orig - final > 0 ? "text-emerald-600" : "text-[#94a3b8]"}`}>{orig - final > 0 ? `${fmt(orig - final)} ${sumWord}` : "—"}</span>
                  </div>
                  <button type="button" onClick={() => onPick(value)}
                    className={`mt-2 w-full rounded-full py-2 text-sm font-bold text-white transition ${active ? "bg-emerald-600 hover:bg-emerald-700" : "bg-sky-500 hover:bg-sky-600"}`}>
                    {active ? `✓ ${pickedWord}` : pickWord}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
