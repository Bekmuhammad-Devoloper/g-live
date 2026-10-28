export type DebtTone = "none" | "warn" | "danger";

export function debtTone(debt: number, overdueMonths: number): DebtTone {
  if (!(debt > 0)) return "none";
  return overdueMonths > 1 ? "danger" : "warn";
}

export const DEBT_TEXT: Record<DebtTone, string> = {
  none: "text-slate-400",
  warn: "text-amber-600 dark:text-amber-400",
  danger: "text-rose-600 dark:text-rose-400",
};

export const DEBT_BADGE: Record<DebtTone, string> = {
  none: "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400",
  warn: "bg-amber-100 text-amber-800 ring-1 ring-amber-300/60 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  danger: "bg-rose-100 text-rose-700 ring-1 ring-rose-300/60 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
};

export const DEBT_HEX: Record<DebtTone, string> = { none: "#94a3b8", warn: "#d97706", danger: "#e11d48" };
