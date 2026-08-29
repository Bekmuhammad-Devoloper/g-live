"use client";

import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { exportRows, printPage } from "@/lib/export";
import { Icon } from "../../_components/Icon";

export default function AttendanceExport({ rows, locale }: { rows: { label: string; value: number }[]; locale: Locale }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => exportRows("davomat-hisoboti", [
          { key: "label", label: tr(locale, { uz: "Ko'rsatkich", ru: "Показатель", en: "Metric", de: "Kennzahl" }) },
          { key: "value", label: tr(locale, { uz: "Soni", ru: "Количество", en: "Count", de: "Anzahl" }) },
        ], rows)}
        title={tr(locale, { uz: "CSV yuklab olish", ru: "Скачать CSV", en: "Download CSV", de: "CSV herunterladen" })}
        className="flex h-10 items-center gap-1.5 rounded-lg border border-emerald-300 px-3 text-sm font-medium text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/40"
      >
        <Icon name="download" className="h-4 w-4" /> CSV
      </button>
      <button
        onClick={() => printPage()}
        title={tr(locale, { uz: "Chop etish", ru: "Печать", en: "Print", de: "Drucken" })}
        className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Icon name="copy" className="h-4 w-4" /> {tr(locale, { uz: "Chop etish", ru: "Печать", en: "Print", de: "Drucken" })}
      </button>
    </div>
  );
}
