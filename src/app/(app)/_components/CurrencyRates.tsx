"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/lib/constants";
import { Icon } from "./Icon";

// Navbar'dagi valyuta kursi (MB — cbu.uz). Ma'lumot /api/rates dan olinadi,
// tashqi API'ga so'rov esa serverda keshlanadi.

interface Rate {
  ccy: string;
  rate: number;
  diff: number;
  date: string;
}
interface Payload {
  rates: Rate[];
  fetchedAt: string;
  stale: boolean;
}

const LS_KEY = "gl-rates";
const REFRESH_MS = 30 * 60_000;

// ─── Umumiy do'kon: komponent bir necha joyda tursa ham fetch bitta bo'ladi ───
let store: Payload | null = null;
let loadedAt = 0;
let seeded = false;
let inflight: Promise<void> | null = null;
const subs = new Set<() => void>();

function emit() {
  for (const f of subs) f();
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

/** Sahifa yangilanganda kurs "sakramasin" — oxirgi qiymat localStorage'dan olinadi. */
function seed() {
  if (seeded) return;
  seeded = true;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const d = JSON.parse(raw) as Payload;
    if (Array.isArray(d?.rates) && d.rates.length) {
      store = d;
      emit();
    }
  } catch {
    // buzuq kesh — e'tiborsiz qoldiramiz
  }
}

async function refresh(force = false) {
  if (!force && store && Date.now() - loadedAt < REFRESH_MS) return;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const r = await fetch("/api/rates", { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as Payload;
      if (!Array.isArray(d?.rates) || d.rates.length === 0) return;
      store = d;
      loadedAt = Date.now();
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(d));
      } catch {
        // localStorage yopiq bo'lsa ham ishlayveradi
      }
      emit();
    } catch {
      // tarmoq xatosi — eski qiymat ekranda qolaveradi
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function useRates() {
  const data = useSyncExternalStore(
    subscribe,
    () => store,
    () => null, // SSR'da bo'sh — hydration mos kelishi uchun
  );

  useEffect(() => {
    seed();
    refresh();
    const id = setInterval(() => refresh(), REFRESH_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return data;
}

// ─── Formatlash (Intl ishlatilmaydi — server/client farqi hydration xatosi berardi) ───
const group = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** 11847.16 → { som: "11 847", tiyin: "16" } — butun qismi yirik, tiyini mayda yoziladi */
function split(n: number) {
  const total = Math.round(Math.abs(n) * 100);
  return {
    som: `${n < 0 ? "−" : ""}${group(String(Math.trunc(total / 100)))}`,
    tiyin: String(total % 100).padStart(2, "0"),
  };
}

/** Kechagi kursga nisbatan foiz: diff — bugungi o'zgarish, rate — bugungi kurs */
function percent(rate: number, diff: number): number | null {
  const yesterday = rate - diff;
  if (!yesterday) return null;
  return (diff / yesterday) * 100;
}

const abs = (n: number) => {
  const { som, tiyin } = split(Math.abs(n));
  return `${som},${tiyin}`;
};

// Har bir valyutaning o'z belgisi va rangi
const META: Record<string, { icon: string; badge: string; name: Record<Locale, string> }> = {
  USD: {
    icon: "dollar",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    name: { uz: "AQSH dollari", ru: "Доллар США", en: "US Dollar" },
  },
  EUR: {
    icon: "euro",
    badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
    name: { uz: "Yevro", ru: "Евро", en: "Euro" },
  },
};
const FALLBACK = {
  icon: "coins",
  badge: "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300",
  name: { uz: "Valyuta", ru: "Валюта", en: "Currency" },
};

function Badge({ ccy, big = false }: { ccy: string; big?: boolean }) {
  const m = META[ccy] ?? FALLBACK;
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center",
        m.badge,
        big ? "h-8 w-8 rounded-xl" : "h-[22px] w-[22px] rounded-lg",
      )}
    >
      <Icon name={m.icon} className={big ? "h-4 w-4" : "h-3 w-3"} strokeWidth={2.4} />
    </span>
  );
}

/** Kurs qiymati: "11 847" yirik + ",16" mayda */
function Value({ n, big = false }: { n: number; big?: boolean }) {
  const { som, tiyin } = split(n);
  return (
    <span className={cn("font-bold tabular-nums tracking-tight", big ? "text-[15px]" : "text-[12.5px]")}>
      {som}
      <span className={cn("font-semibold opacity-50", big ? "text-[11px]" : "text-[10px]")}>,{tiyin}</span>
    </span>
  );
}

/** O'sish/pasayish — rangli yumaloq yorliq (panel uchun) yoki yolg'iz strelka (navbar uchun) */
function Trend({ diff, rate, pill = false }: { diff: number; rate?: number; pill?: boolean }) {
  const up = diff > 0;
  const tone = !diff
    ? "text-slate-400 bg-slate-100 dark:bg-slate-700/60 dark:text-slate-400"
    : up
      ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10"
      : "text-red-500 bg-red-50 dark:text-red-400 dark:bg-red-500/10";

  if (!pill) {
    if (!diff) return <span className="text-[11px] font-bold text-slate-300 dark:text-slate-600">—</span>;
    return (
      <Icon
        name={up ? "trendUp" : "trendDown"}
        className={cn("h-3 w-3", up ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}
      />
    );
  }

  const p = rate != null ? percent(rate, diff) : null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-[3px] text-[10px] font-bold tabular-nums leading-none",
        tone,
      )}
    >
      {!!diff && <Icon name={up ? "trendUp" : "trendDown"} className="h-2.5 w-2.5" />}
      {abs(diff)}
      {p != null && !!diff && <span className="opacity-70">({abs(p)}%)</span>}
    </span>
  );
}

export default function CurrencyRates({ locale, variant = "bar" }: { locale: Locale; variant?: "bar" | "menu" }) {
  const t = getT(locale);
  const data = useRates();
  const [open, setOpen] = useState(false);
  const [spin, setSpin] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(() => {
    setSpin(true);
    void refresh(true).finally(() => setSpin(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const rates = data?.rates ?? [];
  const date = rates[0]?.date ?? "";

  // Kurs hali kelmagan bo'lsa navbarda joy egallamaydi
  if (rates.length === 0) return null;

  const rows = (
    <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
      {rates.map((r) => (
        <div key={r.ccy} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
          <span className="flex items-center gap-2.5">
            <Badge ccy={r.ccy} big />
            <span className="leading-tight">
              <span className="block text-[13px] font-bold text-slate-800 dark:text-slate-100">1 {r.ccy}</span>
              <span className="block text-[10.5px] text-slate-400">{(META[r.ccy] ?? FALLBACK).name[locale]}</span>
            </span>
          </span>
          <span className="flex flex-col items-end gap-1 leading-tight">
            <span className="text-slate-900 dark:text-slate-50">
              <Value n={r.rate} big />
              <span className="ml-1 text-[10px] font-medium text-slate-400">{t("rates.sum")}</span>
            </span>
            <Trend diff={r.diff} rate={r.rate} pill />
          </span>
        </div>
      ))}
    </div>
  );

  const footer = (
    <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-3.5 py-2 dark:border-slate-700/60 dark:bg-slate-900/40">
      <a
        href="https://cbu.uz"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-[10.5px] font-medium text-slate-400 transition hover:text-brand-600 dark:hover:text-brand-400"
      >
        <Icon name="globe" className="h-3 w-3" />
        cbu.uz
      </a>
      <span className="flex items-center gap-1.5 text-[10.5px] font-medium text-slate-400">
        <Icon name="calendar" className="h-3 w-3" />
        {date}
      </span>
    </div>
  );

  // Mobil ko'rinish — avatar menyusi ichida
  if (variant === "menu") {
    return (
      <div className="border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between px-3.5 pb-1 pt-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("rates.title")}</span>
          <span className="text-[10px] text-slate-400">{date}</span>
        </div>
        {rows}
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative hidden xl:block">
      <button
        onClick={() => setOpen((v) => !v)}
        title={`${t("rates.title")} · ${t("rates.source")}${date ? ` · ${date}` : ""}`}
        className={cn(
          "flex h-9 items-center gap-2 rounded-xl border pl-2 pr-1.5 transition",
          open
            ? "border-brand-300 bg-brand-50 dark:border-brand-600 dark:bg-brand-500/10"
            : "border-slate-200/80 bg-slate-50 hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-slate-600 dark:hover:bg-slate-800",
          data?.stale ? "text-slate-400" : "text-slate-700 dark:text-slate-100",
        )}
      >
        {rates.map((r, i) => (
          <span key={r.ccy} className="flex items-center gap-1.5">
            {i > 0 && <span className="mr-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" />}
            <Badge ccy={r.ccy} />
            <Value n={r.rate} />
            <Trend diff={r.diff} />
          </span>
        ))}
        <Icon
          name="chevronDown"
          className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[19rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between gap-2 px-3.5 pb-2 pt-3">
            <span className="leading-tight">
              <span className="block text-[13px] font-bold text-slate-800 dark:text-slate-100">{t("rates.title")}</span>
              <span className="block text-[10.5px] text-slate-400">{t("rates.bank")}</span>
            </span>
            <button
              onClick={reload}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-700 dark:hover:text-brand-400"
              title={t("rates.refresh")}
            >
              <Icon name="refresh" className={cn("h-3.5 w-3.5", spin && "animate-spin")} />
            </button>
          </div>
          {rows}
          {data?.stale && (
            <p className="border-t border-amber-100 bg-amber-50 px-3.5 py-2 text-[10.5px] font-medium text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-400">
              {t("rates.stale")}
            </p>
          )}
          {footer}
        </div>
      )}
    </div>
  );
}
