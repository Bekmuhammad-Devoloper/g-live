"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "./Icon";

const MONTHS: Record<Locale, string[]> = {
  uz: ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"],
  ru: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const WEEK: Record<Locale, string[]> = {
  uz: ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"],
  ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
  en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
};
const p2 = (n: number) => String(n).padStart(2, "0");

const toInput = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
const display = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;

export default function DateTimePicker({ name, defaultValue, placeholder, className, locale = "uz" }: {
  name: string; defaultValue?: string | null; placeholder?: string; className?: string; locale?: Locale;
}) {
  const init = defaultValue ? new Date(defaultValue) : null;
  const [sel, setSel] = useState<Date | null>(init && !isNaN(init.getTime()) ? init : null);
  const [hh, setHh] = useState(sel ? sel.getHours() : 9);
  const [mm, setMm] = useState(sel ? sel.getMinutes() : 0);
  const [view, setView] = useState(() => (sel ?? new Date(2026, 6, 1)));
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const value = sel ? toInput(sel) : "";
  const ph = placeholder ?? tr(locale, { uz: "Sana va vaqt", ru: "Дата и время", en: "Date & time" });

  const openPop = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const H = 380, W = Math.max(300, r.width);
    let top = r.bottom + 6;
    if (top + H > window.innerHeight) top = Math.max(8, r.top - H - 6);
    let left = r.left;
    if (left + W > window.innerWidth) left = window.innerWidth - W - 8;
    setView(sel ?? new Date());
    setCoords({ top, left, width: W });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const pickDay = (d: Date) => setSel(new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm));
  const pickHour = (h: number) => { setHh(h); if (sel) setSel(new Date(sel.getFullYear(), sel.getMonth(), sel.getDate(), h, mm)); };
  const pickMin = (m: number) => { setMm(m); if (sel) setSel(new Date(sel.getFullYear(), sel.getMonth(), sel.getDate(), hh, m)); };
  const today = () => { const n = new Date(); setSel(n); setHh(n.getHours()); setMm(n.getMinutes()); setView(n); };
  const clear = () => setSel(null);

  const y = view.getFullYear(), m = view.getMonth();
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7;
  const start = new Date(y, m, 1 - firstDow);
  const cells = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const isSame = (a: Date, b: Date | null) => !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const now = new Date();

  return (
    <>
      <button ref={triggerRef} type="button" onClick={openPop} className={cn(className, "flex items-center justify-between gap-2 text-left")}>
        <span className={sel ? "text-slate-800 dark:text-slate-100" : "text-slate-400"}>{sel ? display(sel) : ph}</span>
        <Icon name="calendar" className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      <input type="hidden" name={name} value={value} />

      {open && coords && createPortal(
        <>
          <div className="fixed inset-0 z-[95]" onClick={() => setOpen(false)} />
          <div className="fixed z-[96] rounded-2xl border border-slate-200 bg-white p-3 shadow-pop dark:border-slate-700 dark:bg-slate-900" style={{ top: coords.top, left: coords.left, width: coords.width }} onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{MONTHS[locale][m]} {y}</div>
                  <div className="flex gap-1">
                    <NavBtn onClick={() => setView(new Date(y, m - 1, 1))}>‹</NavBtn>
                    <NavBtn onClick={() => setView(new Date(y, m + 1, 1))}>›</NavBtn>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-slate-400">
                  {WEEK[locale].map((w) => <div key={w} className="py-1">{w}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {cells.map((d, i) => {
                    const other = d.getMonth() !== m;
                    const selected = isSame(d, sel);
                    const isToday = isSame(d, now);
                    return (
                      <button key={i} type="button" onClick={() => pickDay(d)}
                        className={cn("grid h-7 place-items-center rounded-md text-xs transition",
                          selected ? "bg-brand-600 font-bold text-white" : other ? "text-slate-300 hover:bg-slate-100 dark:text-slate-600 dark:hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                          !selected && isToday && "ring-1 ring-brand-400")}>
                        {d.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-1">
                <TimeCol label={tr(locale, { uz: "Soat", ru: "Час", en: "Hour" })} items={24} value={hh} onPick={pickHour} />
                <TimeCol label={tr(locale, { uz: "Daq", ru: "Мин", en: "Min" })} items={60} value={mm} onPick={pickMin} step={1} />
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
              <button type="button" onClick={clear} className="rounded-lg px-2 py-1 text-xs font-medium text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">{tr(locale, { uz: "Tozalash", ru: "Очистить", en: "Clear" })}</button>
              <div className="flex gap-1.5">
                <button type="button" onClick={today} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10">{tr(locale, { uz: "Bugun", ru: "Сегодня", en: "Today" })}</button>
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700">{tr(locale, { uz: "Tanlash", ru: "Выбрать", en: "Select" })}</button>
              </div>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

function NavBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="grid h-6 w-6 place-items-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">{children}</button>;
}

function TimeCol({ label, items, value, onPick, step = 1 }: { label: string; items: number; value: number; onPick: (n: number) => void; step?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = ref.current?.querySelector<HTMLButtonElement>("[data-active=true]"); el?.scrollIntoView({ block: "center" }); }, [value]);
  return (
    <div className="flex flex-col">
      <div className="mb-1 text-center text-[10px] font-semibold text-slate-400">{label}</div>
      <div ref={ref} className="h-[184px] w-10 overflow-y-auto rounded-lg border border-slate-100 dark:border-slate-800">
        {Array.from({ length: Math.ceil(items / step) }, (_, i) => i * step).map((n) => (
          <button key={n} type="button" data-active={n === value} onClick={() => onPick(n)}
            className={cn("block w-full py-1 text-center text-xs transition", n === value ? "bg-brand-600 font-bold text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")}>
            {p2(n)}
          </button>
        ))}
      </div>
    </div>
  );
}
