"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";

// Sana filtri — eski loyihadagi kalendar popup. Tanlangan sana ?date=YYYY-MM-DD
// query parametriga yoziladi va serverda kunlik ko'rsatkichlar qayta hisoblanadi.

const p2 = (n: number) => String(n).padStart(2, "0");
const key = (y: number, m: number, d: number) => `${y}-${p2(m + 1)}-${p2(d)}`;

const MONTHS: Record<Locale, string[]> = {
  uz: ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"],
  ru: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const WEEKDAYS: Record<Locale, string[]> = {
  uz: ["Du", "Se", "Cho", "Pa", "Ju", "Sha", "Ya"],
  ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
  en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
};

export default function DateFilter({ locale, value, label }: { locale: Locale; value: string | null; label: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const base = value ? new Date(`${value}T00:00:00`) : new Date();
    return { y: base.getFullYear(), m: base.getMonth() };
  });
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const apply = (date: string | null) => {
    setOpen(false);
    router.push(date ? `${pathname}?date=${date}` : pathname);
  };

  const shift = (delta: number) => {
    setView((v) => {
      const m = v.m + delta;
      if (m < 0) return { y: v.y - 1, m: 11 };
      if (m > 11) return { y: v.y + 1, m: 0 };
      return { y: v.y, m };
    });
  };

  // 42 katakli oy setkasi (dushanbadan boshlanadi)
  const cells: { d: number; cur: boolean; iso: string }[] = [];
  const first = new Date(view.y, view.m, 1).getDay();
  const start = first === 0 ? 6 : first - 1;
  const inMonth = new Date(view.y, view.m + 1, 0).getDate();
  const prevDays = new Date(view.y, view.m, 0).getDate();
  for (let i = start - 1; i >= 0; i--) {
    const pm = view.m === 0 ? 11 : view.m - 1;
    const py = view.m === 0 ? view.y - 1 : view.y;
    cells.push({ d: prevDays - i, cur: false, iso: key(py, pm, prevDays - i) });
  }
  for (let d = 1; d <= inMonth; d++) cells.push({ d, cur: true, iso: key(view.y, view.m, d) });
  for (let d = 1; cells.length < 42; d++) {
    const nm = view.m === 11 ? 0 : view.m + 1;
    const ny = view.m === 11 ? view.y + 1 : view.y;
    cells.push({ d, cur: false, iso: key(ny, nm, d) });
  }
  const today = new Date();
  const todayIso = key(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className="relative flex items-center gap-1.5" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 items-center gap-2 rounded-lg border px-3.5 text-sm font-medium transition",
          value
            ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        )}
      >
        <Icon name="calendar" className="h-4 w-4" />
        {label ?? tr(locale, { uz: "Bugun", ru: "Сегодня", en: "Today" })}
      </button>

      {value && (
        <button
          type="button"
          onClick={() => apply(null)}
          title={tr(locale, { uz: "Tozalash", ru: "Очистить", en: "Clear" })}
          className="grid h-10 w-9 shrink-0 place-items-center rounded-lg bg-red-50 text-red-500 transition hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      )}

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[300px] overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
            <button type="button" onClick={() => shift(-1)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800">
              <Icon name="chevronDown" className="h-4 w-4 rotate-90" />
            </button>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{MONTHS[locale][view.m]} {view.y}</span>
            <button type="button" onClick={() => shift(1)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800">
              <Icon name="chevronDown" className="h-4 w-4 -rotate-90" />
            </button>
          </div>
          <div className="grid grid-cols-7 px-3 pt-2">
            {WEEKDAYS[locale].map((w) => (
              <div key={w} className="py-1 text-center text-[10px] font-semibold text-slate-400">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 px-3 pb-2">
            {cells.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => apply(c.iso)}
                className={cn(
                  "h-8 rounded-lg text-xs font-medium transition",
                  !c.cur && "opacity-30",
                  c.iso === value
                    ? "bg-brand-600 text-white"
                    : c.iso === todayIso
                      ? "text-brand-600 ring-1 ring-brand-400 dark:text-brand-300"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                )}
              >
                {c.d}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 dark:border-slate-800">
            <button type="button" onClick={() => apply(null)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-50 dark:hover:bg-red-500/10">
              {tr(locale, { uz: "Tozalash", ru: "Очистить", en: "Clear" })}
            </button>
            <button type="button" onClick={() => apply(todayIso)} className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-600 transition hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-300">
              {tr(locale, { uz: "Bugun", ru: "Сегодня", en: "Today" })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
