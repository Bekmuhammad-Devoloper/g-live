import type { Locale } from "./constants";
import { tr } from "./tr";

export type DebtTone = "none" | "credit" | "partial" | "full" | "severe";

export function debtTone(debt: number, months: number, credit = 0): DebtTone {
  if (debt > 0) {
    if (months >= 2) return "severe";
    if (months < 1) return "partial";
    return "full";
  }
  return credit > 0 ? "credit" : "none";
}

export function debtMonthsLabel(months: number, locale: Locale): string {
  if (months < 1) return tr(locale, { uz: "qisman", ru: "частично", en: "partial", de: "teilweise" });
  const n = Number.isInteger(months) ? String(months) : months.toFixed(1);
  return tr(locale, { uz: `${n} oy`, ru: `${n} мес.`, en: `${n} mo`, de: `${n} Mon.` });
}

export const DEBT_TEXT: Record<DebtTone, string> = {
  none: "text-slate-500 dark:text-slate-400",
  credit: "text-emerald-600 dark:text-emerald-400",
  partial: "text-amber-600 dark:text-amber-400",
  full: "text-rose-600 dark:text-rose-400",
  severe: "text-slate-900 dark:text-white",
};

export const DEBT_BADGE: Record<DebtTone, string> = {
  none: "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400",
  credit: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300/60 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  partial: "bg-amber-100 text-amber-800 ring-1 ring-amber-300/60 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  full: "bg-rose-100 text-rose-700 ring-1 ring-rose-300/60 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
  severe: "bg-slate-900 text-white ring-1 ring-slate-900 dark:bg-black dark:ring-white/30",
};

export const DEBT_HEX: Record<DebtTone, string> = {
  none: "#94a3b8", credit: "#10b981", partial: "#d97706", full: "#e11d48", severe: "#0f172a",
};

export const DEBT_PANEL: Record<DebtTone, { box: string; icon: string; text: string }> = {
  none: { box: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20", icon: "bg-emerald-500/15 text-emerald-600", text: "text-emerald-700 dark:text-emerald-400" },
  credit: { box: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20", icon: "bg-emerald-500/15 text-emerald-600", text: "text-emerald-700 dark:text-emerald-400" },
  partial: { box: "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20", icon: "bg-amber-500/15 text-amber-600", text: "text-amber-700 dark:text-amber-400" },
  full: { box: "border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20", icon: "bg-rose-500/15 text-rose-600", text: "text-rose-700 dark:text-rose-400" },
  severe: { box: "border-slate-900 bg-slate-900 dark:border-white/20 dark:bg-black", icon: "bg-white/15 text-white", text: "text-white" },
};
