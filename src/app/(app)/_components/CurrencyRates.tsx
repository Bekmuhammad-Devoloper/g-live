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

const diffClass = (d: number) =>
  d > 0 ? "text-emerald-600 dark:text-emerald-400" : d < 0 ? "text-red-500 dark:text-red-400" : "text-slate-400";

// Har bir valyutaning o'z belgisi va rangi
const META: Record<string, { icon: string; badge: string; name: Record<Locale, string> }> = {
  USD: {
    icon: "dollar",
    badge: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
    name: { uz: "AQSH dollari", ru: "Доллар США", en: "US Dollar" },
  },
  EUR: {
    icon: "euro",
    badge: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400",
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
    <span className={cn("flex shrink-0 items-center justify-center rounded-md", m.badge, big ? "h-7 w-7" : "h-5 w-5")}>
      <Icon name={m.icon} className={big ? "h-4 w-4" : "h-3 w-3"} strokeWidth={2.2} />
    </span>
  );
}

/** Kurs qiymati: "11 847" yirik + ",16" mayda */
function Value({ n, big = false }: { n: number; big?: boolean }) {
  const { som, tiyin } = split(n);
  return (
    <span className={cn("font-semibold tabular-nums", big ? "text-[13px]" : "text-[12px]")}>
      {som}
      <span className={cn("font-medium text-slate-400", big ? "text-[11px]" : "text-[10px]")}>,{tiyin}</span>
    </span>
  );
}

function Trend({ diff, withValue = false }: { diff: number; withValue?: boolean }) {
  if (!diff) return <span className="text-[10px] font-medium text-slate-300 dark:text-slate-600">—</span>;
  const { som, tiyin } = split(diff);
  return (
    <span className={cn("flex items-center gap-0.5 text-[10px] font-semibold tabular-nums", diffClass(diff))}>
      <Icon name={diff > 0 ? "trendUp" : "trendDown"} className="h-2.5 w-2.5" />
      {withValue && (
        <span>
          {som.replace("−", "")},{tiyin}
        </span>
      )}
    </span>
  );
}

export default function CurrencyRates({ locale, variant = "bar" }: { locale: Locale; variant?: "bar" | "menu" }) {
  const t = getT(locale);
  const data = useRates();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(() => {
    void refresh(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const rates = data?.rates ?? [];
  const date = rates[0]?.date ?? "";

  // Kurs hali kelmagan bo'lsa navbarda joy egallamaydi
  if (rates.length === 0) return null;

  const rows = rates.map((r) => (
    <div key={r.ccy} className="flex items-center justify-between gap-3 px-3 py-2">
      <span className="flex items-center gap-2.5">
        <Badge ccy={r.ccy} big />
        <span className="leading-tight">
          <span className="block text-[13px] font-semibold text-slate-700 dark:text-slate-100">1 {r.ccy}</span>
          <span className="block text-[10px] text-slate-400">{(META[r.ccy] ?? FALLBACK).name[locale]}</span>
        </span>
      </span>
      <span className="text-right leading-tight text-slate-900 dark:text-slate-50">
        <span className="block">
          <Value n={r.rate} big />
          <span className="ml-1 text-[10px] font-normal text-slate-400">{t("rates.sum")}</span>
        </span>
        <span className="flex justify-end">
          <Trend diff={r.diff} withValue />
        </span>
      </span>
    </div>
  ));

  // Mobil ko'rinish — avatar menyusi ichida
  if (variant === "menu") {
    return (
      <div className="border-b border-slate-100 py-1 dark:border-slate-800">
        <div className="flex items-center justify-between px-3 py-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("rates.title")}</span>
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
          "flex h-9 items-center gap-2 rounded-xl border px-2 transition",
          open
            ? "border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-500/10"
            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800",
          data?.stale ? "text-slate-400" : "text-slate-700 dark:text-slate-200",
        )}
      >
        {rates.map((r, i) => (
          <span key={r.ccy} className="flex items-center gap-1.5">
            {i > 0 && <span className="mr-0.5 h-4 w-px bg-slate-200 dark:bg-slate-700" />}
            <Badge ccy={r.ccy} />
            <Value n={r.rate} />
            <Trend diff={r.diff} />
          </span>
        ))}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-[17rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-pop dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("rates.title")}</span>
            <button onClick={reload} className="text-slate-400 transition hover:text-brand-600" title={t("rates.refresh")}>
              <Icon name="refresh" className="h-3.5 w-3.5" />
            </button>
          </div>
          {rows}
          <div className="mt-1 border-t border-slate-100 px-3 py-2 dark:border-slate-800">
            <a
              href="https://cbu.uz"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between text-[11px] text-slate-400 transition hover:text-brand-600"
            >
              <span>{t("rates.source")}</span>
              <span>{date}</span>
            </a>
            {data?.stale && <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">{t("rates.stale")}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
