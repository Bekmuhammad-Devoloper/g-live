"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/constants";

const MONTHS: Record<Locale, string[]> = {
  uz: ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"],
  ru: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
};
const MONTHS_SHORT: Record<Locale, string[]> = {
  uz: ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"],
  ru: ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  de: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
};
const WEEK: Record<Locale, string[]> = {
  uz: ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"],
  ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
  en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
  de: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
};
const TXT: Record<Locale, { clear: string; today: string; thisMonth: string; date: string; month: string }> = {
  uz: { clear: "Tozalash", today: "Bugun", thisMonth: "Shu oy", date: "kk.oo.yyyy", month: "oy.yyyy" },
  ru: { clear: "Очистить", today: "Сегодня", thisMonth: "Этот месяц", date: "дд.мм.гггг", month: "мм.гггг" },
  en: { clear: "Clear", today: "Today", thisMonth: "This month", date: "dd.mm.yyyy", month: "mm.yyyy" },
  de: { clear: "Löschen", today: "Heute", thisMonth: "Dieser Monat", date: "tt.mm.jjjj", month: "mm.jjjj" },
};

const p2 = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${p2(m + 1)}-${p2(d)}`;

function parse(v: string | undefined | null, month: boolean): { y: number; m: number; d: number } | null {
  if (!v) return null;
  const r = month ? /^(\d{4})-(\d{2})$/.exec(v) : /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!r) return null;
  return { y: +r[1], m: +r[2] - 1, d: month ? 1 : +r[3] };
}

function pageLocale(): Locale {
  if (typeof document === "undefined") return "uz";
  const l = document.documentElement.lang;
  return (["uz", "ru", "en", "de"] as const).includes(l as Locale) ? (l as Locale) : "uz";
}

type ChangeEvent = { target: { value: string; name: string }; currentTarget: { value: string; name: string } };

export interface DateInputProps {
  type?: "date" | "month";
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: ChangeEvent) => void;
  className?: string;
  placeholder?: string;
  title?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  locale?: Locale;
}

export default function DateInput({ type = "date", name, value, defaultValue, onChange, className, placeholder, title, required, disabled, min, max, locale }: DateInputProps) {
  const isMonth = type === "month";
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = controlled ? value ?? "" : inner;
  const sel = parse(current, isMonth);

  const [loc, setLoc] = useState<Locale>(locale ?? "uz");
  useEffect(() => { if (!locale) setLoc(pageLocale()); }, [locale]);
  const t = TXT[loc];

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"days" | "months" | "years">(isMonth ? "months" : "days");
  const now = new Date();
  const [view, setView] = useState(() => ({ y: sel?.y ?? now.getFullYear(), m: sel?.m ?? now.getMonth() }));
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const emit = (v: string) => {
    if (!controlled) setInner(v);
    const ev = { target: { value: v, name: name ?? "" }, currentTarget: { value: v, name: name ?? "" } };
    onChange?.(ev);
  };

  const openPicker = () => {
    if (disabled) return;
    const s = parse(current, isMonth);
    setView({ y: s?.y ?? now.getFullYear(), m: s?.m ?? now.getMonth() });
    setMode(isMonth ? "months" : "days");
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const b = btnRef.current?.getBoundingClientRect();
      if (!b) return;
      const W = 288, H = popRef.current?.offsetHeight ?? 340;
      let left = Math.min(b.left, window.innerWidth - W - 8);
      left = Math.max(8, left);
      let top = b.bottom + 6;
      if (top + H > window.innerHeight - 8 && b.top - H - 6 > 8) top = b.top - H - 6;
      setPos({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, mode]);

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

  const minP = parse(min, isMonth), maxP = parse(max, isMonth);
  const key = (y: number, m: number, d: number) => y * 10000 + m * 100 + d;
  const outOfRange = (y: number, m: number, d: number) =>
    (minP && key(y, m, d) < key(minP.y, minP.m, isMonth ? 1 : minP.d)) || (maxP && key(y, m, d) > key(maxP.y, maxP.m, isMonth ? 1 : maxP.d));

  const display = sel ? (isMonth ? `${MONTHS[loc][sel.m]} ${sel.y}` : `${p2(sel.d)}.${p2(sel.m + 1)}.${sel.y}`) : "";

  const first = new Date(view.y, view.m, 1);
  const lead = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(view.y, view.m, 1 - lead + i);
    return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate(), out: d.getMonth() !== view.m };
  });
  const todayKey = key(now.getFullYear(), now.getMonth(), now.getDate());
  const selKey = sel ? key(sel.y, sel.m, sel.d) : -1;

  const shift = (delta: number) => {
    if (mode === "days") setView((v) => { const d = new Date(v.y, v.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
    else if (mode === "months") setView((v) => ({ ...v, y: v.y + delta }));
    else setView((v) => ({ ...v, y: v.y + delta * 12 }));
  };
  const yearStart = view.y - (view.y % 12);

  const navBtn = "grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white";
  const cellBase = "grid place-items-center rounded-lg text-sm transition";

  const pop = open && pos && typeof document !== "undefined" ? createPortal(
    <div
      ref={popRef}
      style={{ top: pos.top, left: pos.left, width: 288 }}
      className="animate-pop-in fixed z-[200] rounded-2xl border border-slate-200 bg-white p-3 shadow-pop dark:border-white/10 dark:bg-[#0f1c36]"
    >
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className={navBtn} onClick={() => shift(-1)} aria-label="prev">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "days" ? "months" : mode === "months" ? "years" : isMonth ? "months" : "days")}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/10"
        >
          {mode === "days" ? `${MONTHS[loc][view.m]} ${view.y}` : mode === "months" ? view.y : `${yearStart} — ${yearStart + 11}`}
        </button>
        <button type="button" className={navBtn} onClick={() => shift(1)} aria-label="next">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      {mode === "days" && (
        <>
          <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {WEEK[loc].map((w, i) => <div key={w} className={cn("py-1", i >= 5 && "text-rose-400/80")}>{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((c) => {
              const k = key(c.y, c.m, c.d);
              const dis = !!outOfRange(c.y, c.m, c.d);
              const isSel = k === selKey;
              return (
                <button
                  key={k}
                  type="button"
                  disabled={dis}
                  onClick={() => { emit(iso(c.y, c.m, c.d)); setOpen(false); }}
                  className={cn(
                    cellBase, "h-9",
                    isSel ? "bg-brand-600 font-semibold text-white shadow-sm hover:bg-brand-700"
                      : k === todayKey ? "font-semibold text-brand-600 ring-1 ring-inset ring-brand-300 hover:bg-brand-50 dark:text-brand-300 dark:ring-brand-500/50 dark:hover:bg-brand-500/10"
                      : c.out ? "text-slate-300 hover:bg-slate-50 dark:text-slate-600 dark:hover:bg-white/5"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10",
                    dis && "pointer-events-none opacity-30",
                  )}
                >
                  {c.d}
                </button>
              );
            })}
          </div>
        </>
      )}

      {mode === "months" && (
        <div className="grid grid-cols-3 gap-1.5">
          {MONTHS_SHORT[loc].map((mn, i) => {
            const isSel = sel && sel.y === view.y && sel.m === i;
            const isNow = now.getFullYear() === view.y && now.getMonth() === i;
            const dis = isMonth && !!outOfRange(view.y, i, 1);
            return (
              <button
                key={mn}
                type="button"
                disabled={dis}
                onClick={() => {
                  if (isMonth) { emit(`${view.y}-${p2(i + 1)}`); setOpen(false); }
                  else { setView({ y: view.y, m: i }); setMode("days"); }
                }}
                className={cn(
                  cellBase, "h-11 font-medium",
                  isSel ? "bg-brand-600 text-white hover:bg-brand-700"
                    : isNow ? "text-brand-600 ring-1 ring-inset ring-brand-300 hover:bg-brand-50 dark:text-brand-300 dark:ring-brand-500/50"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10",
                  dis && "pointer-events-none opacity-30",
                )}
              >
                {mn}
              </button>
            );
          })}
        </div>
      )}

      {mode === "years" && (
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 12 }, (_, i) => yearStart + i).map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => { setView((v) => ({ ...v, y })); setMode("months"); }}
              className={cn(
                cellBase, "h-11 font-medium",
                sel?.y === y ? "bg-brand-600 text-white hover:bg-brand-700"
                  : now.getFullYear() === y ? "text-brand-600 ring-1 ring-inset ring-brand-300 dark:text-brand-300 dark:ring-brand-500/50"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10",
              )}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-white/10">
        <button type="button" onClick={() => { emit(""); setOpen(false); }} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-500/10">
          {t.clear}
        </button>
        <button
          type="button"
          onClick={() => { emit(isMonth ? `${now.getFullYear()}-${p2(now.getMonth() + 1)}` : iso(now.getFullYear(), now.getMonth(), now.getDate())); setOpen(false); }}
          className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:hover:bg-brand-500/25"
        >
          {isMonth ? t.thisMonth : t.today}
        </button>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title={title}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={cn(
          "relative inline-flex items-center justify-between gap-2 text-left outline-none disabled:cursor-not-allowed disabled:opacity-60",
          open && "border-brand-400 ring-2 ring-brand-500/15",
          className,
        )}
      >
        <span className={cn("truncate tabular-nums", !display && "text-slate-400 dark:text-slate-500")}>{display || placeholder || (isMonth ? t.month : t.date)}</span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9.5h18M8 3v3M16 3v3" />
        </svg>
      </button>
      {name && <input type="hidden" name={name} value={current} />}
      {required && (
        <input tabIndex={-1} aria-hidden required value={current} onChange={() => {}} className="pointer-events-none absolute h-0 w-0 opacity-0" />
      )}
      {pop}
    </>
  );
}
