"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { MONTHS, WEEK } from "../../_components/DateInput";
import { DATE_PRESETS, dotDay, isoDay, leadDateRange } from "../_lib/dateRange";

const DAY = 86400000;

export default function DateRangeFilter({ locale, preset, from, to, onChange }: {
  locale: Locale;
  preset: string;
  from: string;
  to: string;
  onChange: (preset: string, from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [view, setView] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });

  const range = leadDateRange(preset, from, to);
  const first = range && Number.isFinite(range.start) ? range.start : null;
  const last = range && Number.isFinite(range.end) ? range.end - DAY : null;
  const word = L("Sana", "Дата", "Date", "Datum");
  const presetDef = DATE_PRESETS.find((p) => p.key === preset);
  const label = presetDef
    ? `${word}: ${tr(locale, presetDef.label)}`
    : preset === "custom" && (first !== null || last !== null)
      ? first !== null && last !== null && first === last
        ? dotDay(first)
        : `${first !== null ? dotDay(first) : "…"} – ${last !== null ? dotDay(last) : "…"}`
      : `${word}: ${L("Barchasi", "Все", "All", "Alle")}`;
  const active = !!preset;

  const openPop = () => {
    const base = new Date(last ?? first ?? Date.now());
    setView({ y: base.getFullYear(), m: base.getMonth() });
    setAnchor(null);
    setHover(null);
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const b = btnRef.current?.getBoundingClientRect();
      if (!b) return;
      const W = popRef.current?.offsetWidth ?? 520, H = popRef.current?.offsetHeight ?? 380;
      const left = Math.max(8, Math.min(b.right - W, window.innerWidth - W - 8));
      let top = b.bottom + 8;
      if (top + H > window.innerHeight - 8 && b.top - H - 8 > 8) top = b.top - H - 8;
      setPos({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      const n = e.target as Node;
      if (popRef.current?.contains(n) || btnRef.current?.contains(n)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);

  const apply = (p: string, f = "", t = "") => {
    onChange(p, f, t);
    setAnchor(null);
    setOpen(false);
  };

  const pick = (t: number) => {
    if (anchor === null) {
      setAnchor(t);
      setHover(t);
      return;
    }
    apply("custom", isoDay(Math.min(anchor, t)), isoDay(Math.max(anchor, t)));
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const lead = (new Date(view.y, view.m, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(view.y, view.m, 1 - lead + i);
    return { t: d.getTime(), d: d.getDate(), out: d.getMonth() !== view.m, weekend: i % 7 >= 5 };
  });
  let selA: number | null = null, selB: number | null = null;
  if (anchor !== null) {
    const h = hover ?? anchor;
    selA = Math.min(anchor, h);
    selB = Math.max(anchor, h);
  } else if (first !== null || last !== null) {
    selA = first ?? last;
    selB = last ?? first;
  }
  const shift = (delta: number) => setView((v) => { const d = new Date(v.y, v.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const navBtn = "grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white";
  const presetBtn = (on: boolean) => cn(
    "whitespace-nowrap rounded-lg px-3 py-2 text-left text-[13px] font-medium transition",
    on ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.07]",
  );

  const pop = open && typeof document !== "undefined" ? createPortal(
    <div
      ref={popRef}
      style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
      className="animate-pop-in fixed z-[200] flex max-w-[calc(100vw-16px)] flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-pop sm:flex-row dark:border-white/10 dark:bg-[#0f1c36]"
    >
      <div className="flex flex-wrap gap-1 sm:w-[150px] sm:flex-col sm:flex-nowrap sm:border-r sm:border-slate-100 sm:pr-3 dark:sm:border-white/[0.06]">
        <button type="button" onClick={() => apply("")} className={presetBtn(!preset)}>{L("Barchasi", "Все", "All", "Alle")}</button>
        {DATE_PRESETS.map((p) => (
          <button key={p.key} type="button" onClick={() => apply(p.key)} className={presetBtn(preset === p.key)}>{tr(locale, p.label)}</button>
        ))}
      </div>

      <div className="w-[280px]">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" className={navBtn} onClick={() => shift(-1)} aria-label="prev">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{MONTHS[locale][view.m]} {view.y}</span>
          <button type="button" className={navBtn} onClick={() => shift(1)} aria-label="next">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
        <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {WEEK[locale].map((w, i) => <div key={w} className={cn("py-1", i >= 5 && "text-rose-400/80")}>{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5" onMouseLeave={() => anchor !== null && setHover(anchor)}>
          {cells.map((c) => {
            const inRange = selA !== null && selB !== null && c.t >= selA && c.t <= selB;
            const edge = c.t === selA || c.t === selB;
            const startEdge = c.t === selA && selA !== selB;
            const endEdge = c.t === selB && selA !== selB;
            return (
              <div
                key={c.t}
                className={cn(
                  "h-9",
                  inRange && !edge && "bg-brand-50 dark:bg-brand-500/15",
                  startEdge && "rounded-l-lg bg-brand-50 dark:bg-brand-500/15",
                  endEdge && "rounded-r-lg bg-brand-50 dark:bg-brand-500/15",
                )}
              >
                <button
                  type="button"
                  onClick={() => pick(c.t)}
                  onMouseEnter={() => anchor !== null && setHover(c.t)}
                  className={cn(
                    "grid h-9 w-full place-items-center rounded-lg text-sm tabular-nums transition",
                    edge
                      ? "bg-brand-600 font-semibold text-white shadow-sm"
                      : inRange
                        ? "text-brand-700 hover:bg-brand-100 dark:text-brand-200 dark:hover:bg-brand-500/25"
                        : c.out
                          ? "text-slate-300 hover:bg-slate-100 dark:text-slate-600 dark:hover:bg-white/5"
                          : cn("hover:bg-slate-100 dark:hover:bg-white/10", c.weekend ? "text-rose-500/80 dark:text-rose-300/80" : "text-slate-700 dark:text-slate-200"),
                    c.t === today && !edge && "font-semibold ring-1 ring-inset ring-brand-300 dark:ring-brand-500/50",
                  )}
                >
                  {c.d}
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-white/[0.06]">
          <span className="text-[11px] text-slate-400">
            {anchor !== null
              ? L("Tugash kunini tanlang", "Выберите конечную дату", "Pick the end date", "Enddatum wählen")
              : L("Boshlanish kunini tanlang", "Выберите начальную дату", "Pick the start date", "Startdatum wählen")}
          </span>
          {active && (
            <button type="button" onClick={() => apply("")} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-300">
              {L("Tozalash", "Очистить", "Clear", "Löschen")}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPop())}
        className={cn(
          "flex h-10 items-center gap-2 rounded-lg border bg-white px-3 text-sm outline-none transition dark:bg-slate-800",
          active || open
            ? "border-brand-400 font-medium text-brand-700 dark:border-brand-500/60 dark:text-brand-200"
            : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300",
          open && "ring-2 ring-brand-500/15",
        )}
      >
        <Icon name="calendar" className="h-4 w-4 shrink-0 opacity-70" />
        <span className="whitespace-nowrap tabular-nums">{label}</span>
        <Icon name="chevronDown" className={cn("h-4 w-4 shrink-0 opacity-60 transition", open && "rotate-180")} />
      </button>
      {pop}
    </>
  );
}
