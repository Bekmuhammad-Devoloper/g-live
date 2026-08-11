"use client";

// Operator sozlamalari sahifasining ko'rinish (presentational) bo'laklari.
// Barcha matnlar tashqaridan tayyor holda uzatiladi — bu yerda tarjima qilinmaydi.

import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";

export function Card({ icon, title, desc, children, className }: {
  icon: string; title: string; desc?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900", className)}>
      <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
        <Icon name={icon} className="h-5 w-5 text-slate-400" /> {title}
      </h3>
      {desc && <p className="mb-4 mt-1 text-xs text-slate-400">{desc}</p>}
      <div className={desc ? "" : "mt-4"}>{children}</div>
    </div>
  );
}

export function ToggleRow({ on, onChange, icon, title, desc }: {
  on: boolean; onChange: (v: boolean) => void; icon: string; title: string; desc: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3.5 dark:bg-white/[0.03]">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-slate-400 shadow-sm dark:bg-slate-800">
          <Icon name={icon} className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{title}</p>
          <p className="truncate text-xs text-slate-400">{desc}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!on)}
        aria-pressed={on}
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-violet-500" : "bg-slate-300 dark:bg-slate-600")}
      >
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}

export function ThemeBtn({ active, onClick, icon, title, desc, tone }: {
  active: boolean; onClick: () => void; icon: string; title: string; desc: string; tone: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative rounded-2xl border-2 p-5 text-left transition",
        active ? "border-violet-500 bg-violet-500/5" : "border-slate-200 hover:border-violet-300 dark:border-slate-700"
      )}
    >
      {active && (
        <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-violet-500 text-white">
          <Icon name="check" className="h-3.5 w-3.5" />
        </span>
      )}
      <span className={cn("mb-3 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br text-white shadow-soft", tone)}>
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</p>
      <p className="mt-0.5 text-xs text-slate-400">{desc}</p>
    </button>
  );
}

const moneyTones: Record<string, string> = {
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
};

export function MoneyCard({ icon, tone, label, value, unit, hint }: {
  icon: string; tone: string; label: string; value: string; unit: string; hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <span className={cn("grid h-9 w-9 place-items-center rounded-lg", moneyTones[tone] ?? moneyTones.violet)}>
          <Icon name={icon} className="h-4 w-4" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
        {value} <span className="text-sm font-normal text-slate-400">{unit}</span>
      </p>
      {hint && <p className="mt-2 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function TabBtn({ active, onClick, icon, children }: {
  active: boolean; onClick: () => void; icon: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
        active
          ? "bg-brand-600 text-white shadow-soft"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      )}
    >
      <Icon name={icon} className="h-4 w-4" /> {children}
    </button>
  );
}

export function SaveBtn({ locale, pending, onClick }: { locale: Locale; pending: boolean; onClick: () => void }) {
  return (
    <div className="mt-5 flex justify-end">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="h-11 rounded-xl bg-brand-700 px-8 text-sm font-bold text-white transition hover:bg-brand-800 disabled:opacity-60"
      >
        {pending
          ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving..." })
          : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save" })}
      </button>
    </div>
  );
}
