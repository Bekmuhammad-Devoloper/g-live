"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { Icon } from "../../(app)/_components/Icon";
import { PHONE_COUNTRIES, flagSrc, phoneCountry, type PhoneCountry } from "@/lib/phoneCodes";

/**
 * Telefon davlat kodi tanlovi — oddiy <select> o'rniga (uni bezab bo'lmaydi).
 * Tugma: bayroq + kod. Bosilsa telefonda pastdan varaq, katta ekranda oyna:
 * "MDH" va "Yevropa" guruhlari, har qatorda SVG bayroq, davlat nomi, kod, belgi.
 * Bayroqlar emoji emas — /public/flags/*.svg (hamma qurilmada bir xil).
 */
/** `locked` — davlat o'zgartirilmaydi (oflayn ro'yxat: faqat O'zbekiston raqami). */
export default function CountryPicker({ value, onChange, locked = false }: { value: string; onChange: (iso: string) => void; locked?: boolean }) {
  const [open, setOpen] = useState(false);
  const country = phoneCountry(value);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  const pick = (iso: string) => { onChange(iso); setOpen(false); };

  return (
    <>
      <button
        type="button"
        onClick={() => { if (!locked) setOpen(true); }}
        disabled={locked}
        aria-label="Davlat kodi"
        className={cn(
          "flex min-h-[52px] shrink-0 items-center gap-2 self-stretch border-r border-slate-200 bg-slate-50 pl-3 pr-2.5 transition dark:border-white/10 dark:bg-white/[0.04]",
          locked ? "cursor-default" : "active:bg-slate-100",
        )}
      >
        <Flag c={country} className="h-6 w-8" />
        <span className="text-[15px] font-semibold text-slate-700 dark:text-slate-200">{country.code}</span>
        {!locked && <Icon name="chevronDown" className="h-3.5 w-3.5 text-slate-400" strokeWidth={2.2} />}
      </button>

      {open && !locked && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/45 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="Davlat kodi"
            onClick={(e) => e.stopPropagation()}
            className="animate-pop-in flex max-h-[82dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-sm sm:rounded-3xl dark:bg-[#111a2e]"
          >
            {/* Sarlavha */}
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <div>
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden dark:bg-white/15" />
                <div className="text-[15px] font-bold text-slate-900 dark:text-white">Davlat kodi</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 dark:hover:bg-white/10">
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Group title="MDH" items={PHONE_COUNTRIES.filter((c) => c.group === "cis")} value={value} onPick={pick} />
              <Group title="Yevropa" items={PHONE_COUNTRIES.filter((c) => c.group === "eu")} value={value} onPick={pick} />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function Group({ title, items, value, onPick }: { title: string; items: PhoneCountry[]; value: string; onPick: (iso: string) => void }) {
  return (
    <div className="mt-2">
      <div className="px-2 pb-1.5 pt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{title}</div>
      <div className="space-y-0.5">
        {items.map((c) => {
          const on = c.iso === value;
          return (
            <button
              key={c.iso}
              type="button"
              onClick={() => onPick(c.iso)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition active:scale-[0.99]",
                on ? "bg-brand-50 dark:bg-brand-500/15" : "hover:bg-slate-50 dark:hover:bg-white/[0.05]",
              )}
            >
              <Flag c={c} className="h-[21px] w-7" />
              <span className={cn("min-w-0 flex-1 truncate text-[15px] font-medium", on ? "text-brand-700 dark:text-brand-200" : "text-slate-800 dark:text-slate-100")}>{c.name}</span>
              <span className={cn("shrink-0 text-[14px] font-semibold tabular-nums", on ? "text-brand-600 dark:text-brand-300" : "text-slate-400")}>{c.code}</span>
              {on && <Icon name="check" className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" strokeWidth={2.2} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** SVG bayroq — 4:3, yumaloq burchak, nozik chegara (oq fonli bayroqlar ko'rinsin) */
export function Flag({ c, className }: { c: PhoneCountry; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={flagSrc(c.iso)} alt={c.name} loading="lazy" draggable={false} className={cn("shrink-0 rounded-[3px] object-cover ring-1 ring-black/10 dark:ring-white/15", className)} />
  );
}
