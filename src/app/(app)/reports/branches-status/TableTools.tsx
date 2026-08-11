"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { exportRows } from "@/lib/export";
import { type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";

const BASE = "/reports/branches-status";

export function SortHeader({
  col,
  label,
  active,
  dir,
  locale,
  className,
}: {
  col: string;
  label: string;
  active: string;
  dir: string;
  locale: Locale;
  className?: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const isActive = active === col;
  const nextDir = isActive && dir === "desc" ? "asc" : "desc";
  const go = () => {
    const p = new URLSearchParams(sp.toString());
    p.set("sort", col);
    p.set("dir", nextDir);
    router.push(`${BASE}?${p.toString()}`);
  };
  return (
    <button
      type="button"
      onClick={go}
      className={`inline-flex items-center gap-1 text-left hover:text-brand-600 dark:hover:text-brand-300 ${className ?? ""}`}
      title={tr(locale, { uz: "Saralash", ru: "Сортировка", en: "Sort" })}
    >
      <span>{label}</span>
      <Icon
        name="arrow"
        className={`h-3 w-3 shrink-0 ${isActive ? "text-brand-500" : "text-slate-300 dark:text-slate-600"} ${isActive && dir === "asc" ? "rotate-180" : ""}`}
      />
    </button>
  );
}

export function ExportButton({
  columns,
  rows,
}: {
  columns: { key: string; label: string }[];
  rows: Record<string, string | number>[];
}) {
  const onClick = () => exportRows("filiallar-holati", columns, rows);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      <Icon name="download" className="h-4 w-4" />
      CSV
    </button>
  );
}
