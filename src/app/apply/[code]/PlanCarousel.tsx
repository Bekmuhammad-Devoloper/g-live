"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { planPriceLabel, promoPeriod, sumLabel, type SalesPlan } from "@/lib/devpanel/salesTypes";
import { Icon } from "../../(app)/_components/Icon";

const ROTATE_MS = 6000;
const RESUME_MS = 15000;
const SWIPE_PX = 40;

export type AppliedPromo = { code: string; discount: number; months: number };

const limitLabel = (n: number | null, unit: string) => {
  if (!n) return `Cheksiz ${unit}`;
  if (n === 1) return `1 ta ${unit}`;
  return `${n} tagacha ${unit}`;
};

export default function PlanCarousel({ plans, selected, onSelect, promo }: {
  plans: SalesPlan[];
  selected: string;
  onSelect: (id: string) => void;
  promo: AppliedPromo | null;
}) {
  const [index, setIndex] = useState(0);
  const [delay, setDelay] = useState(ROTATE_MS);
  const [hold, setHold] = useState(false);
  const [still, setStill] = useState(false);
  const touchX = useRef<number | null>(null);
  const swiped = useRef(false);
  const count = plans.length;
  const stopped = hold || still || !!selected || count < 2;

  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (stopped) return;
    const t = setTimeout(() => {
      setDelay(ROTATE_MS);
      setIndex((i) => (i + 1) % count);
    }, delay);
    return () => clearTimeout(t);
  }, [index, delay, stopped, count]);

  const go = (i: number) => {
    setDelay(RESUME_MS);
    setIndex((i + count) % count);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < SWIPE_PX) return;
    swiped.current = true;
    go(index + (dx < 0 ? 1 : -1));
  };

  return (
    <div
      onPointerEnter={(e) => { if (e.pointerType === "mouse") setHold(true); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") setHold(false); }}
      onFocus={(e) => { if (e.target.matches(":focus-visible")) setHold(true); }}
      onBlur={() => setHold(false)}
    >
      <div
        className="grid touch-pan-y overflow-hidden"
        onTouchStart={(e) => { swiped.current = false; touchX.current = e.touches[0].clientX; }}
        onTouchEnd={onTouchEnd}
        onClickCapture={(e) => {
          if (!swiped.current) return;
          swiped.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {plans.map((p, i) => {
          const on = selected === p.id;
          const rel = (i - index + count) % count;
          const first = promo && p.price ? Math.max(0, p.price - promo.discount) : null;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              aria-hidden={rel !== 0}
              tabIndex={rel === 0 ? 0 : -1}
              onClick={() => {
                setDelay(RESUME_MS);
                onSelect(on ? "" : p.id);
              }}
              className={cn(
                "flex w-full flex-col justify-start rounded-2xl border-2 px-3.5 py-3 text-left transition-[transform,opacity,background-color,border-color] duration-700 ease-in-out [grid-area:1/1] motion-reduce:transition-none",
                rel === 0 ? "translate-x-0 opacity-100" : cn("pointer-events-none opacity-0", rel === count - 1 && count > 2 ? "-translate-x-full" : "translate-x-full"),
                on
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 dark:border-white/10 dark:bg-[#1e2635] dark:text-slate-200",
              )}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[15px] font-bold">{p.name}</span>
                  {p.popular && (
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", on ? "bg-white/20 text-white" : "bg-brand-50 text-brand-600 dark:bg-white/[0.08] dark:text-brand-300")}>Ko&apos;p tanlanadi</span>
                  )}
                </span>
                <span className="shrink-0 text-right text-[14px] font-extrabold tabular-nums">
                  {planPriceLabel(p.price)}
                  {!!p.price && <span className={cn("ml-1 text-[11px] font-medium", on ? "text-white/80" : "text-slate-400")}>/ oy</span>}
                </span>
              </span>
              <span className={cn("mt-1 block text-[12px]", on ? "text-white/80" : "text-slate-500 dark:text-slate-400")}>
                {limitLabel(p.students, "o'quvchi")} · {limitLabel(p.branches, "filial")}
              </span>
              {promo && first !== null && (
                <span className={cn("mt-2 rounded-lg px-2.5 py-1.5 text-[12.5px] font-bold tabular-nums", on ? "bg-white/20 text-white" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300")}>
                  {promoPeriod(promo.months)}: {sumLabel(first)}
                </span>
              )}
              {p.features.length > 0 && (
                <span className={cn("mt-2 block space-y-1 border-t pt-2", on ? "border-white/20" : "border-slate-100 dark:border-white/10")}>
                  {p.features.map((x) => (
                    <span key={x} className="flex items-start gap-1.5 text-[12.5px] leading-snug">
                      <Icon name="check" className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", !on && "text-emerald-500")} strokeWidth={2.4} />
                      {x}
                    </span>
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {count > 1 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {plans.map((p, i) => (
            <button
              key={p.id}
              type="button"
              aria-current={i === index}
              onClick={() => go(i)}
              className={cn(
                "flex h-8 min-w-0 flex-1 items-center justify-center gap-1 truncate rounded-full border px-2 text-[12px] font-semibold transition",
                i === index
                  ? "border-brand-500 bg-brand-500/15 text-brand-700 dark:text-brand-200"
                  : "border-slate-200 text-slate-500 hover:border-brand-300 dark:border-white/10 dark:text-slate-400",
              )}
            >
              {selected === p.id && <Icon name="check" className="h-3 w-3 shrink-0" strokeWidth={2.6} />}
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
