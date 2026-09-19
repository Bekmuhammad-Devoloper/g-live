"use client";

import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "./Icon";

/**
 * Sig'im maydoni — "− / son / +" stepper va tez tanlov chiplari.
 * Xona tanlansa xona sig'imi taklif sifatida to'ladi, lekin QAT'IY chegara emas:
 * guruh yig'ishda 15 kishi yig'ib, keyin 12 tasi qolishi odatiy hol — shuning
 * uchun xonadan ko'p qo'yish mumkin (faqat eslatma chiqadi).
 */
export default function CapacityStepper({
  name,
  value,
  onChange,
  roomCapacity = null,
  locale,
  min = 1,
  max = 200,
  quick = [8, 10, 12, 15, 20],
}: {
  /** Forma uchun yashirin input nomi (server action FormData'dan o'qiydi) */
  name?: string;
  value: number;
  onChange: (n: number) => void;
  /** Tanlangan xonaning sig'imi — taklif va eslatma uchun */
  roomCapacity?: number | null;
  locale: Locale;
  min?: number;
  max?: number;
  quick?: number[];
}) {
  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.trunc(n)));
  const over = roomCapacity && roomCapacity > 0 ? value - roomCapacity : 0;
  const btn = "grid h-10 w-10 shrink-0 place-items-center text-slate-600 transition hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-white/[0.06]";

  return (
    <div>
      {name && <input type="hidden" name={name} value={value} />}
      <div className="flex h-10 items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/60">
        <button type="button" onClick={() => onChange(clamp(value - 1))} disabled={value <= min} className={btn} aria-label="−">
          <Icon name="personMinus" className="h-4 w-4" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            if (digits === "") return onChange(min);
            onChange(clamp(Number(digits)));
          }}
          onFocus={(e) => e.target.select()}
          className="w-full min-w-0 border-x border-slate-200 bg-transparent text-center text-[15px] font-bold tabular-nums text-slate-800 outline-none dark:border-slate-700 dark:text-slate-100"
        />
        <button type="button" onClick={() => onChange(clamp(value + 1))} disabled={value >= max} className={btn} aria-label="+">
          <Icon name="personPlus" className="h-4 w-4" />
        </button>
      </div>

      {/* Tez tanlov */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {Array.from(new Set([...(roomCapacity && roomCapacity > 0 ? [roomCapacity] : []), ...quick])).sort((a, b) => a - b).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(clamp(n))}
            className={cn(
              "rounded-md px-2 py-0.5 text-[11px] font-semibold transition",
              n === value
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.1]",
            )}
          >
            {n}{roomCapacity === n ? ` · ${L("xona", "кабинет", "room", "Raum")}` : ""}
          </button>
        ))}
      </div>

      {/* Eslatma: xonadan ko'p — ruxsat, lekin bilib qo'ysin */}
      {over > 0 && (
        <p className="mt-1 text-[11px] leading-snug text-amber-600 dark:text-amber-400">
          {L(
            `Xona sig'imidan ${over} ta ko'p (xona: ${roomCapacity}). Guruh yig'ishda ruxsat — keyin kamaysa xonaga sig'adi.`,
            `На ${over} больше вместимости кабинета (${roomCapacity}). Допустимо при наборе — часть обычно отсеивается.`,
            `${over} more than the room holds (${roomCapacity}). Allowed while recruiting — some usually drop off.`,
            `${over} mehr als der Raum fasst (${roomCapacity}). Beim Sammeln erlaubt — meist springen einige ab.`,
          )}
        </p>
      )}
    </div>
  );
}
