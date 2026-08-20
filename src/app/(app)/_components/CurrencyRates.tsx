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
const SYMBOL: Record<string, string> = { USD: "$", EUR: "€" };

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
const fmtInt = (n: number) => group(String(Math.round(n)));
const fmtExact = (n: number) => {
  const whole = Math.trunc(n);
  const cents = Math.round((n - whole) * 100);
  return `${group(String(whole))},${String(cents).padStart(2, "0")}`;
};
const fmtDiff = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmtExact(Math.abs(n))}`;

const diffClass = (d: number) =>
  d > 0 ? "text-emerald-600 dark:text-emerald-400" : d < 0 ? "text-red-500 dark:text-red-400" : "text-slate-400";

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
      <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-[13px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
          {SYMBOL[r.ccy] ?? r.ccy}
        </span>
        1 {r.ccy}
      </span>
      <span className="text-right">
        <span className="block text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {fmtExact(r.rate)} <span className="text-[11px] font-normal text-slate-400">{t("rates.sum")}</span>
        </span>
        <span className={cn("block text-[11px] font-medium tabular-nums", diffClass(r.diff))}>{fmtDiff(r.diff)}</span>
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
    <div ref={boxRef} className="relative hidden lg:block">
      <button
        onClick={() => setOpen((v) => !v)}
        title={`${t("rates.title")} · ${t("rates.source")}${date ? ` · ${date}` : ""}`}
        className={cn(
          "flex h-9 items-center gap-2 rounded-lg border px-2.5 text-[11px] font-semibold tabular-nums transition",
          open
            ? "border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-500/10"
            : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
          data?.stale ? "text-slate-400" : "text-slate-600 dark:text-slate-300",
        )}
      >
        {rates.map((r) => (
          <span key={r.ccy} className="flex items-center gap-1">
            <span className="text-slate-400">{SYMBOL[r.ccy] ?? r.ccy}</span>
            <span>{fmtInt(r.rate)}</span>
            <span className={cn("text-[10px]", diffClass(r.diff))}>{r.diff > 0 ? "▲" : r.diff < 0 ? "▼" : "•"}</span>
          </span>
        ))}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-pop dark:border-slate-700 dark:bg-slate-800">
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
