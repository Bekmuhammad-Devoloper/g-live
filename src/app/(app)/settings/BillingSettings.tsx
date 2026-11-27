"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
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

const LIMITS: Record<string, { students: number | null; branches: number | null }> = {
  START: { students: 100, branches: 1 },
  STANDART: { students: 300, branches: 3 },
  PRO: { students: 1000, branches: 5 },
  PREMIUM: { students: null, branches: null },
};

const glyph = (d: ReactNode, cls = "h-4 w-4") => (
  <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);

function PlanZoom({ plan, locale, sumWord, selected, onClose, onStep, onPick }: {
  plan: { name: string; monthly: number };
  locale: Locale;
  sumWord: string;
  selected: string;
  onClose: () => void;
  onStep: (d: number) => void;
  onPick: (value: string) => void;
}) {
  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const oy = L("oy", "мес.", "mo", "Mo.");
  const idx = Math.max(0, PLANS.findIndex((p) => p.name === plan.name));
  const lim = LIMITS[plan.name];
  const chip = "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300";
  const studentsText = !lim ? "" : lim.students === null
    ? L("Cheksiz o'quvchi", "Ученики без лимита", "Unlimited students", "Unbegrenzt Schüler")
    : L(`${fmt(lim.students)} tagacha o'quvchi`, `До ${fmt(lim.students)} учеников`, `Up to ${fmt(lim.students)} students`, `Bis ${fmt(lim.students)} Schüler`);
  const branchesText = !lim ? "" : lim.branches === null
    ? L("Cheksiz filial", "Филиалы без лимита", "Unlimited branches", "Unbegrenzt Filialen")
    : L(`${lim.branches} ta filial`, `${lim.branches} ${lim.branches === 1 ? "филиал" : lim.branches < 5 ? "филиала" : "филиалов"}`, `${lim.branches} ${lim.branches === 1 ? "branch" : "branches"}`, `${lim.branches} ${lim.branches === 1 ? "Filiale" : "Filialen"}`);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-[6px] sm:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={plan.name}
        className="animate-pop-in relative max-h-full w-full max-w-5xl overflow-y-auto rounded-[28px] border border-slate-200/80 bg-white shadow-[0_40px_120px_-30px_rgba(2,6,23,0.65)] dark:border-white/10 dark:bg-[#0b1324]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-transparent px-5 pb-6 pt-5 sm:px-8 sm:pt-6 dark:border-white/[0.06] dark:from-white/[0.03]">
          <div className="flex items-center justify-between gap-3">
            <div role="tablist" className="flex min-w-0 gap-1 overflow-x-auto rounded-full border border-slate-200 bg-slate-100/80 p-1 [scrollbar-width:none] dark:border-white/10 dark:bg-white/[0.04]">
              {PLANS.map((p, i) => (
                <button
                  key={p.name}
                  type="button"
                  role="tab"
                  aria-selected={i === idx}
                  onClick={() => onStep(i - idx)}
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1.5 text-[10px] font-bold tracking-[0.04em] transition sm:px-3.5 sm:text-[11px] sm:tracking-[0.08em]",
                    i === idx
                      ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.15)] dark:bg-white/[0.14] dark:text-white"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={L("Yopish", "Закрыть", "Close", "Schließen")}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
            >
              {glyph(<path d="M6 6l12 12M18 6L6 18" />, "h-[18px] w-[18px]")}
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div className="min-w-0">
              <h2 className="text-[34px] font-black leading-none tracking-tight text-slate-900 sm:text-[40px] dark:text-white">{plan.name}</h2>
              <p className="mt-2.5 text-[14px] text-slate-500 dark:text-slate-400">
                <span className="font-bold tabular-nums text-slate-900 dark:text-white">{fmt(plan.monthly)}</span> {sumWord} / {oy}
              </p>
            </div>
            {lim && (
              <div className="flex flex-wrap gap-2">
                <span className={chip}>
                  {glyph(<><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" /><circle cx="9.5" cy="7.5" r="3.5" /><path d="M21 20v-1.5a4 4 0 0 0-3-3.85M15.5 4.15a3.5 3.5 0 0 1 0 6.7" /></>, "h-3.5 w-3.5 text-slate-400")}
                  {studentsText}
                </span>
                <span className={chip}>
                  {glyph(<><path d="M3 21h18M5 21V7l7-4 7 4v14" /><path d="M9 21v-5h6v5M9 10h.01M15 10h.01" /></>, "h-3.5 w-3.5 text-slate-400")}
                  {branchesText}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 px-5 pb-6 pt-8 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
          {PERIODS.map((pr) => {
            const orig = plan.monthly * pr.months;
            const final = priceOf(plan.monthly, pr.months, pr.off);
            const total = pr.months + pr.bonus;
            const save = orig - final;
            const value = `${plan.name}|${pr.months}`;
            const active = selected === value;
            const best = pr.months === 12;
            const row = (icon: ReactNode, label: string, val: string, good: boolean) => (
              <li className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-slate-500 dark:text-slate-400">
                  <span className="text-slate-400 dark:text-slate-500">{icon}</span>
                  {label}
                </span>
                <span className={cn("whitespace-nowrap font-semibold tabular-nums", good ? "text-emerald-600 dark:text-emerald-400" : val === "—" ? "text-slate-300 dark:text-slate-600" : "text-slate-900 dark:text-white")}>{val}</span>
              </li>
            );
            return (
              <div
                key={pr.months}
                className={cn(
                  "relative flex flex-col rounded-2xl border p-5 transition duration-200",
                  active
                    ? "border-emerald-500 bg-emerald-50/40 shadow-[0_0_0_4px_rgba(16,185,129,0.12)] dark:bg-emerald-500/[0.06]"
                    : best
                      ? "border-amber-300 bg-gradient-to-b from-amber-50/90 to-white shadow-[0_22px_50px_-28px_rgba(217,119,6,0.55)] dark:border-amber-400/40 dark:from-amber-400/[0.08] dark:to-transparent"
                      : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20",
                )}
              >
                {best && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-2.5 py-[3px] text-[10px] font-bold uppercase tracking-[0.14em] text-[#0f172a] shadow-sm">
                    {L("Eng foydali", "Выгоднее всего", "Best value", "Bester Wert")}
                  </span>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-bold text-slate-900 dark:text-white">
                    {pr.months} {oy}
                  </span>
                  {pr.off > 0 && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-emerald-600 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-400">
                      −{Math.round(pr.off * 100)}%
                    </span>
                  )}
                </div>

                <div className="mt-5">
                  <div className={cn("h-5 text-[13px] font-medium tabular-nums text-slate-400 line-through decoration-slate-300 dark:decoration-slate-600", pr.off > 0 ? "" : "invisible")}>
                    {fmt(orig)}
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="whitespace-nowrap text-[26px] font-extrabold leading-tight tracking-tight tabular-nums text-slate-900 dark:text-white">{fmt(final)}</span>
                    <span className="text-[13px] font-semibold text-slate-400">{sumWord}</span>
                  </div>
                  <div className="mt-1 text-[12.5px] text-slate-500 dark:text-slate-400">
                    ≈ <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{fmt(Math.round(final / total))}</span> {sumWord} / {oy}
                  </div>
                </div>

                <ul className="mt-5 space-y-2.5 border-t border-dashed border-slate-200 pt-4 text-[13px] dark:border-white/10">
                  {row(glyph(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>, "h-3.5 w-3.5"), L("Jami muddat", "Итого срок", "Total term", "Laufzeit"), `${total} ${oy}`, false)}
                  {row(glyph(<><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M19 12v9H5v-9" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" /></>, "h-3.5 w-3.5"), L("Bonus", "Бонус", "Bonus", "Bonus"), pr.bonus > 0 ? `+${pr.bonus} ${oy}` : "—", pr.bonus > 0)}
                  {row(glyph(<><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><path d="M7.5 7.5h.01" /></>, "h-3.5 w-3.5"), L("Tejaysiz", "Экономия", "You save", "Ersparnis"), save > 0 ? `${fmt(save)} ${sumWord}` : "—", save > 0)}
                </ul>

                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => onPick(value)}
                  className={cn(
                    "mt-6 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[14px] font-semibold transition active:scale-[0.98]",
                    active
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : best
                        ? "bg-amber-400 text-[#0f172a] hover:bg-amber-300"
                        : "bg-[#0f172a] text-white hover:bg-[#1e293b] dark:bg-white dark:text-[#0f172a] dark:hover:bg-slate-200",
                  )}
                >
                  {active && glyph(<path d="m5 12 5 5L20 7" />)}
                  {active ? L("Tanlangan", "Выбрано", "Selected", "Ausgewählt") : L("Tanlash", "Выбрать", "Choose", "Auswählen")}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-slate-100 px-5 py-4 text-[12px] text-slate-400 sm:px-8 dark:border-white/[0.06]">
          <span className="flex items-center gap-2">
            {glyph(<><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></>, "h-3.5 w-3.5")}
            {L("6 oy va undan uzoq muddatga 10% chegirma va bonus oylar", "От 6 месяцев: скидка 10% и бонусные месяцы", "6 months or longer: 10% off plus bonus months", "Ab 6 Monaten: 10 % Rabatt und Bonusmonate")}
          </span>
          <span className="hidden items-center gap-1.5 sm:flex">
            <kbd className="rounded-md border border-slate-200 px-1.5 py-0.5 font-sans text-[11px] text-slate-500 dark:border-white/10 dark:text-slate-400">←</kbd>
            <kbd className="rounded-md border border-slate-200 px-1.5 py-0.5 font-sans text-[11px] text-slate-500 dark:border-white/10 dark:text-slate-400">→</kbd>
            <span className="mr-2">{L("tariflar", "тарифы", "plans", "Tarife")}</span>
            <kbd className="rounded-md border border-slate-200 px-1.5 py-0.5 font-sans text-[11px] text-slate-500 dark:border-white/10 dark:text-slate-400">Esc</kbd>
            <span>{L("yopish", "закрыть", "close", "schließen")}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
