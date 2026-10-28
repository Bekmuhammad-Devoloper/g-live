"use client";

import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";

export const PAGE_SIZE = 50;

export default function Pagination({ page, total, onChange, locale, pageSize = PAGE_SIZE }: {
  page: number;
  total: number;
  onChange: (p: number) => void;
  locale: Locale;
  pageSize?: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const list: (number | "…")[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) list.push(i);
    else if (list[list.length - 1] !== "…") list.push("…");
  }
  const btn = "grid h-8 min-w-8 place-items-center rounded-lg px-2 text-sm transition disabled:opacity-40";
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 px-5 py-3 dark:border-slate-800">
      <span className="text-xs text-slate-500">{from}–{to} / {total}</span>
      <div className="flex items-center gap-1">
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={tr(locale, { uz: "Oldingi", ru: "Назад", en: "Previous", de: "Zurück" })}
          className={cn(btn, "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")}>‹</button>
        {list.map((p, i) =>
          p === "…" ? <span key={`e${i}`} className="px-1 text-slate-400">…</span> : (
            <button type="button" key={p} onClick={() => onChange(p)}
              className={cn(btn, p === page ? "bg-brand-600 font-semibold text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")}>{p}</button>
          ),
        )}
        <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label={tr(locale, { uz: "Keyingi", ru: "Вперёд", en: "Next", de: "Weiter" })}
          className={cn(btn, "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")}>›</button>
      </div>
    </div>
  );
}

const p2 = (n: number) => String(n).padStart(2, "0");

export const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};

export const fmtDate = (v: string) => {
  if (!v) return "—";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : new Date(v);
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
};

export const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${fmtDate(iso)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
