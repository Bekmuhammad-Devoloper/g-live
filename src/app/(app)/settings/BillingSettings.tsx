"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";

const STORAGE_KEY = "gl-billing-history";

type T4 = { uz: string; ru: string; en: string; de: string };

interface Theme {
  card: string;
  head: string;
  iconWrap: string;
  tagline: string;
  name: string;
  headPrice: string;
  unit: string;
  meta: string;
  body: string;
  row: string;
  bestRow: string;
  monthBox: string;
  price: string;
  strike: string;
  offChip: string;
  bonus: string;
  lift: string;
  shine?: boolean;
  badge?: { text: T4; cls: string; icon: ReactNode };
}

interface Plan {
  name: string;
  monthly: number;
  students: number | null;
  branches: number | null;
  tagline: T4;
  icon: ReactNode;
  theme: Theme;
}

const svg = (d: ReactNode, cls = "h-4 w-4") => (
  <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);

const PLANS: Plan[] = [
  {
    name: "START",
    monthly: 350000,
    students: 100,
    branches: 1,
    tagline: { uz: "Boshlash uchun", ru: "Для старта", en: "To get started", de: "Zum Start" },
    icon: svg(<><path d="M12 21v-8" /><path d="M12 13C12 8.5 8.5 5 3.5 5c0 4.5 3.5 8 8.5 8Z" /><path d="M12 13c0-4 3-7 8-7 0 4-3 7-8 7Z" /></>),
    theme: {
      card: "border border-[#e2e8f0] bg-[#ffffff] shadow-[0_1px_3px_rgba(15,23,42,0.08)] hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.35)]",
      head: "border-b border-[#eef2f7] bg-[#f8fafc] text-[#0f172a]",
      iconWrap: "bg-[#e2e8f0] text-[#475569]",
      tagline: "text-[#64748b]",
      name: "text-[19px] text-[#0f172a]",
      headPrice: "text-[20px] text-[#0f172a]",
      unit: "text-[#64748b]",
      meta: "text-[#64748b]",
      body: "",
      row: "bg-[#f8fafc]",
      bestRow: "ring-1 ring-[#cbd5e1]",
      monthBox: "bg-[#e2e8f0] text-[#334155]",
      price: "text-[#0f172a]",
      strike: "text-[#94a3b8]",
      offChip: "bg-[#fee2e2] text-[#dc2626]",
      bonus: "text-[#059669]",
      lift: "",
    },
  },
  {
    name: "STANDART",
    monthly: 890000,
    students: 300,
    branches: 3,
    tagline: { uz: "O'sish uchun", ru: "Для роста", en: "To grow", de: "Zum Wachsen" },
    icon: svg(<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />),
    theme: {
      card: "border border-[#bae6fd] bg-[#ffffff] shadow-[0_8px_22px_-12px_rgba(14,165,233,0.55)] hover:shadow-[0_18px_36px_-14px_rgba(14,165,233,0.6)]",
      head: "bg-gradient-to-br from-[#e0f2fe] to-[#dbeafe] text-[#0c4a6e]",
      iconWrap: "bg-[#0ea5e9] text-[#ffffff]",
      tagline: "text-[#0369a1]",
      name: "text-[20px] text-[#075985]",
      headPrice: "text-[21px] text-[#0c4a6e]",
      unit: "text-[#0369a1]",
      meta: "text-[#0369a1]",
      body: "",
      row: "bg-[#f0f9ff]",
      bestRow: "ring-1 ring-[#7dd3fc]",
      monthBox: "bg-[#0ea5e9] text-[#ffffff]",
      price: "text-[#0c4a6e]",
      strike: "text-[#7dd3fc]",
      offChip: "bg-[#fee2e2] text-[#dc2626]",
      bonus: "text-[#059669]",
      lift: "",
    },
  },
  {
    name: "PRO",
    monthly: 1410000,
    students: 1000,
    branches: 5,
    tagline: { uz: "Kengayish uchun", ru: "Для масштаба", en: "To scale", de: "Zum Skalieren" },
    icon: svg(<path d="M13 2 4 14h7l-1 8 9-12h-7Z" />),
    theme: {
      card: "border-2 border-[#7c3aed] bg-[#ffffff] shadow-[0_18px_40px_-14px_rgba(124,58,237,0.6)] hover:shadow-[0_24px_48px_-14px_rgba(124,58,237,0.7)]",
      head: "bg-gradient-to-br from-[#8b5cf6] via-[#7c3aed] to-[#4f46e5] text-[#ffffff]",
      iconWrap: "bg-[#ffffff]/20 text-[#ffffff]",
      tagline: "text-[#ede9fe]",
      name: "text-[22px] text-[#ffffff]",
      headPrice: "text-[22px] text-[#ffffff]",
      unit: "text-[#ddd6fe]",
      meta: "text-[#ede9fe]",
      body: "",
      row: "bg-[#f5f3ff]",
      bestRow: "ring-1 ring-[#c4b5fd]",
      monthBox: "bg-[#7c3aed] text-[#ffffff]",
      price: "text-[#2e1065]",
      strike: "text-[#a78bfa]",
      offChip: "bg-[#fee2e2] text-[#dc2626]",
      bonus: "text-[#059669]",
      lift: "min-[1400px]:-translate-y-1",
      badge: {
        text: { uz: "Ommabop", ru: "Популярный", en: "Popular", de: "Beliebt" },
        cls: "bg-gradient-to-r from-[#f43f5e] to-[#f97316] text-[#ffffff] shadow-[0_6px_16px_-6px_rgba(244,63,94,0.9)]",
        icon: svg(<path d="M12 22c4 0 7-2.7 7-6.8 0-3.4-2.3-5.6-3.8-7.2-.5 2-1.6 3-2.7 3.4.5-3.3-1-6.5-3.8-8.4.2 3.6-1.6 5.5-3.2 7.4C4.2 12 5 13.8 5 15.2 5 19.3 8 22 12 22Z" />, "h-3 w-3"),
      },
    },
  },
  {
    name: "PREMIUM",
    monthly: 2850000,
    students: null,
    branches: null,
    tagline: { uz: "Cheksiz imkon", ru: "Без лимитов", en: "No limits", de: "Grenzenlos" },
    icon: svg(<path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5Z" />),
    theme: {
      card: "border-2 border-[#fbbf24] bg-gradient-to-b from-[#211807] via-[#130d04] to-[#060402] shadow-[0_22px_50px_-16px_rgba(245,158,11,0.7)] hover:shadow-[0_28px_60px_-16px_rgba(245,158,11,0.8)]",
      head: "bg-gradient-to-br from-[#fde68a] via-[#fbbf24] to-[#d97706] text-[#1c1305]",
      iconWrap: "bg-[#1c1305]/15 text-[#1c1305]",
      tagline: "text-[#422006]",
      name: "text-[23px] text-[#1c1305]",
      headPrice: "text-[23px] text-[#1c1305]",
      unit: "text-[#422006]",
      meta: "text-[#422006]",
      body: "",
      row: "bg-[#ffffff]/[0.06] ring-1 ring-[#fbbf24]/15",
      bestRow: "ring-1 ring-[#fbbf24]/60 bg-[#fbbf24]/[0.08]",
      monthBox: "bg-gradient-to-b from-[#fde68a] to-[#f59e0b] text-[#1c1305]",
      price: "text-[#fde68a]",
      strike: "text-[#fde68a]/45",
      offChip: "bg-[#f59e0b]/20 text-[#fcd34d]",
      bonus: "text-[#6ee7b7]",
      lift: "min-[1400px]:-translate-y-2",
      shine: true,
      badge: {
        text: { uz: "VIP", ru: "VIP", en: "VIP", de: "VIP" },
        cls: "bg-[#0b0803] text-[#fcd34d] ring-1 ring-[#fbbf24] shadow-[0_6px_18px_-6px_rgba(251,191,36,0.95)]",
        icon: svg(<path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5Z" />, "h-3 w-3"),
      },
    },
  },
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

const usersIcon = svg(<><path d="M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" /><circle cx="10" cy="8" r="3.5" /><path d="M20 19v-1a3.5 3.5 0 0 0-2.5-3.4" /><path d="M15.5 4.7a3.5 3.5 0 0 1 0 6.6" /></>, "h-3.5 w-3.5");
const branchIcon = svg(<><path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16" /><path d="M15 9h4a1 1 0 0 1 1 1v11" /><path d="M8 8h3M8 12h3M8 16h3" /><path d="M2 21h20" /></>, "h-3.5 w-3.5");

function PlanMeta({ plan, locale }: { plan: Plan; locale: Locale }) {
  const unlimited = tr(locale, { uz: "Cheksiz", ru: "Без лимита", en: "Unlimited", de: "Unbegrenzt" });
  const students = plan.students === null
    ? `${unlimited} ${tr(locale, { uz: "o'quvchi", ru: "учеников", en: "students", de: "Schüler" })}`
    : tr(locale, { uz: `${fmt(plan.students)} tagacha o'quvchi`, ru: `до ${fmt(plan.students)} учеников`, en: `up to ${fmt(plan.students)} students`, de: `bis ${fmt(plan.students)} Schüler` });
  const branches = plan.branches === null
    ? `${unlimited} ${tr(locale, { uz: "filial", ru: "филиалов", en: "branches", de: "Filialen" })}`
    : tr(locale, { uz: `${plan.branches} ta filial`, ru: `${plan.branches} ${plan.branches === 1 ? "филиал" : "филиала"}`, en: `${plan.branches} ${plan.branches === 1 ? "branch" : "branches"}`, de: `${plan.branches} ${plan.branches === 1 ? "Filiale" : "Filialen"}` });
  return (
    <div className={cn("mt-2.5 flex flex-col gap-1 text-[11.5px] font-semibold", plan.theme.meta)}>
      <span className="flex items-center gap-1.5">{usersIcon}{students}</span>
      <span className="flex items-center gap-1.5">{branchIcon}{branches}</span>
    </div>
  );
}

function PlanCard({ plan, locale, sumWord, onOpen }: { plan: Plan; locale: Locale; sumWord: string; onOpen: () => void }) {
  const t = plan.theme;
  const oy = tr(locale, { uz: "oy", ru: "мес", en: "mo", de: "Mo" });
  const perMonth = tr(locale, { uz: "oyiga", ru: "в месяц", en: "per month", de: "pro Monat" });
  const gift = tr(locale, { uz: "oy sovg'a", ru: "мес. в подарок", en: "mo free", de: "Mo gratis" });
  return (
    <button
      type="button"
      onClick={onOpen}
      title={tr(locale, { uz: "Batafsil ko'rish", ru: "Подробнее", en: "View details", de: "Details ansehen" })}
      className={cn("group relative flex flex-col rounded-2xl text-left transition duration-300 hover:-translate-y-1.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#fbbf24]/50", t.card, t.lift)}
    >
      {t.badge && (
        <span className={cn("absolute -top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.14em]", t.badge.cls)}>
          {t.badge.icon}
          {tr(locale, t.badge.text)}
        </span>
      )}
      <div className={cn("relative overflow-hidden rounded-t-[14px] px-4 pb-4 pt-5", t.head)}>
        {t.shine && <span aria-hidden className="gl-shine" />}
        <div className="relative flex items-center justify-between gap-2">
          <span className={cn("grid h-8 w-8 place-items-center rounded-lg", t.iconWrap)}>{plan.icon}</span>
          <span className={cn("truncate text-[10px] font-bold uppercase tracking-[0.16em]", t.tagline)}>{tr(locale, plan.tagline)}</span>
        </div>
        <div className={cn("relative mt-3 font-black leading-none tracking-tight", t.name)}>{plan.name}</div>
        <div className="relative mt-2 flex flex-wrap items-baseline gap-x-1.5">
          <span className={cn("font-black leading-tight tracking-tight tabular-nums", t.headPrice)}>{fmt(plan.monthly)}</span>
          <span className={cn("text-[11px] font-semibold", t.unit)}>{sumWord} / {perMonth}</span>
        </div>
        <div className="relative"><PlanMeta plan={plan} locale={locale} /></div>
      </div>
      <div className={cn("flex flex-1 flex-col gap-1.5 p-2.5", t.body)}>
        {PERIODS.map((pr) => {
          const orig = plan.monthly * pr.months;
          const final = priceOf(plan.monthly, pr.months, pr.off);
          const best = pr.months === 12;
          return (
            <div key={pr.months} className={cn("flex items-center gap-2 rounded-xl px-2 py-1.5", t.row, best && t.bestRow)}>
              <div className={cn("flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg leading-none", t.monthBox)}>
                <span className="text-[15px] font-black">{pr.months}</span>
                <span className="mt-0.5 text-[8.5px] font-bold uppercase tracking-wide">{oy}</span>
              </div>
              <div className="min-w-0 flex-1 text-right">
                {pr.off > 0 && (
                  <div className="flex items-center justify-end gap-1 leading-none">
                    <span className={cn("text-[10.5px] font-semibold tabular-nums line-through", t.strike)}>{fmt(orig)}</span>
                    <span className={cn("rounded-full px-1.5 py-[3px] text-[9.5px] font-extrabold leading-none", t.offChip)}>−{Math.round(pr.off * 100)}%</span>
                  </div>
                )}
                <div className={cn("mt-0.5 whitespace-nowrap text-[15.5px] font-extrabold leading-tight tabular-nums", t.price)}>{fmt(final)}</div>
                {pr.bonus > 0 && <div className={cn("text-[10px] font-bold leading-tight", t.bonus)}>+{pr.bonus} {gift}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </button>
  );
}

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
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
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
          <div className="grid grid-cols-1 gap-4 pt-3 sm:grid-cols-2 min-[1400px]:grid-cols-4 min-[1400px]:gap-3">
            {PLANS.map((p) => (
              <PlanCard key={p.name} plan={p} locale={locale} sumWord={sumWord} onOpen={() => setZoom(p.name)} />
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between px-1 text-sm">
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
  plan: Plan;
  locale: Locale;
  sumWord: string;
  selected: string;
  onClose: () => void;
  onStep: (d: number) => void;
  onPick: (value: string) => void;
}) {
  const t = plan.theme;
  const dark = plan.name === "PREMIUM";
  const oy = tr(locale, { uz: "oy", ru: "мес.", en: "months", de: "Monate" });
  const perMonth = tr(locale, { uz: "oyiga", ru: "в месяц", en: "per month", de: "pro Monat" });
  const bonusWord = tr(locale, { uz: "oy sovg'a", ru: "мес. в подарок", en: "months free", de: "Monate gratis" });
  const totalWord = tr(locale, { uz: "Jami muddat", ru: "Итого срок", en: "Total term", de: "Gesamtlaufzeit" });
  const saveWord = tr(locale, { uz: "Tejaysiz", ru: "Экономия", en: "You save", de: "Ersparnis" });
  const pickWord = tr(locale, { uz: "Tanlash", ru: "Выбрать", en: "Choose", de: "Auswählen" });
  const pickedWord = tr(locale, { uz: "Tanlangan", ru: "Выбрано", en: "Selected", de: "Ausgewählt" });
  const navBtn = "flex h-10 w-10 items-center justify-center rounded-full bg-[#ffffff]/25 text-current ring-1 ring-current/20 backdrop-blur transition hover:bg-[#ffffff]/40";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617]/70 p-3 backdrop-blur-sm sm:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={plan.name}
        className={cn("relative max-h-full w-full max-w-5xl overflow-y-auto rounded-3xl shadow-2xl", dark ? "bg-[#0b0803] ring-2 ring-[#fbbf24]" : "bg-[#ffffff]")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={cn("relative overflow-hidden px-6 pb-6 pt-6 sm:px-8", t.head)}>
          {t.shine && <span aria-hidden className="gl-shine" />}
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className={cn("grid h-10 w-10 place-items-center rounded-xl", t.iconWrap)}>{plan.icon}</span>
                <span className={cn("text-xs font-bold uppercase tracking-[0.18em]", t.tagline)}>{tr(locale, plan.tagline)}</span>
                {t.badge && (
                  <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em]", t.badge.cls)}>{t.badge.icon}{tr(locale, t.badge.text)}</span>
                )}
              </div>
              <div className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{plan.name}</div>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
                <span className="text-3xl font-black tabular-nums">{fmt(plan.monthly)}</span>
                <span className={cn("text-sm font-semibold", t.unit)}>{sumWord} / {perMonth}</span>
              </div>
              <PlanMeta plan={plan} locale={locale} />
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
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-8 lg:grid-cols-4">
          {PERIODS.map((pr) => {
            const orig = plan.monthly * pr.months;
            const final = priceOf(plan.monthly, pr.months, pr.off);
            const total = pr.months + pr.bonus;
            const value = `${plan.name}|${pr.months}`;
            const active = selected === value;
            const best = pr.months === 12;
            return (
              <div key={pr.months}
                className={cn(
                  "relative flex flex-col overflow-hidden rounded-2xl",
                  t.row,
                  best && t.bestRow,
                  active && "ring-4 ring-[#10b981]/60",
                )}>
                {best && (
                  <span className={cn("absolute right-2 top-2 rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider", dark ? "bg-[#fbbf24] text-[#1c1305]" : "bg-[#10b981] text-[#ffffff]")}>
                    {tr(locale, { uz: "Eng foydali", ru: "Выгоднее всего", en: "Best value", de: "Bester Wert" })}
                  </span>
                )}
                <div className="flex items-center gap-3 px-4 pt-4">
                  <div className={cn("flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl leading-none", t.monthBox)}>
                    <span className="text-2xl font-black">{pr.months}</span>
                    <span className="mt-0.5 text-[10px] font-bold uppercase">{oy}</span>
                  </div>
                  {pr.off > 0 && (
                    <div className="leading-tight">
                      <div className={cn("text-sm font-semibold tabular-nums line-through", t.strike)}>{fmt(orig)}</div>
                      <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-extrabold", t.offChip)}>−{Math.round(pr.off * 100)}%</span>
                    </div>
                  )}
                </div>
                <div className="px-4 pb-1 pt-3">
                  <div className={cn("text-[28px] font-black leading-tight tracking-tight tabular-nums", t.price)}>{fmt(final)}</div>
                  <div className={cn("text-sm font-bold", dark ? "text-[#fde68a]/80" : "text-[#475569]")}>{sumWord}</div>
                  <div className={cn("mt-1 text-[12.5px] font-semibold", dark ? "text-[#fde68a]/70" : "text-[#64748b]")}>≈ {fmt(Math.round(final / total))} {sumWord} {perMonth}</div>
                </div>
                <div className={cn("mt-auto space-y-1.5 px-4 pb-4 pt-3 text-[13px]", dark ? "text-[#fef3c7]/80" : "text-[#334155]")}>
                  <div className="flex items-center justify-between">
                    <span>{totalWord}</span>
                    <span className={cn("font-extrabold", dark ? "text-[#fde68a]" : "text-[#0f172a]")}>{total} {oy}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{tr(locale, { uz: "Bonus", ru: "Бонус", en: "Bonus", de: "Bonus" })}</span>
                    <span className={cn("font-extrabold", pr.bonus > 0 ? t.bonus : dark ? "text-[#fde68a]/40" : "text-[#94a3b8]")}>{pr.bonus > 0 ? `+${pr.bonus} ${bonusWord}` : "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{saveWord}</span>
                    <span className={cn("font-extrabold", orig - final > 0 ? t.bonus : dark ? "text-[#fde68a]/40" : "text-[#94a3b8]")}>{orig - final > 0 ? `${fmt(orig - final)} ${sumWord}` : "—"}</span>
                  </div>
                  <button type="button" onClick={() => onPick(value)}
                    className={cn(
                      "mt-2 w-full rounded-full py-2 text-sm font-extrabold transition",
                      active ? "bg-[#059669] text-[#ffffff] hover:bg-[#047857]" : dark ? "bg-gradient-to-r from-[#fde68a] to-[#f59e0b] text-[#1c1305] hover:brightness-110" : cn(t.monthBox, "hover:brightness-110"),
                    )}>
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
