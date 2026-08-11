"use client";

import { exportRows, printPage } from "@/lib/export";
import { type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";

export default function LeaveExport({ rows, filename, locale }: { rows: { name: string; count: number }[]; filename: string; locale: Locale }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => exportRows(filename, [
          { key: "name", label: tr(locale, { uz: "Sabab nomi", ru: "Причина", en: "Reason" }) },
          { key: "count", label: tr(locale, { uz: "Ketgan o'quvchi soni", ru: "Число ушедших учеников", en: "Number of students who left" }) },
        ], rows)}
        title={tr(locale, { uz: "CSV yuklab olish", ru: "Скачать CSV", en: "Download CSV" })}
        className="flex h-11 items-center gap-1.5 rounded-xl border border-emerald-300 px-3 text-sm font-medium text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/40"
      >
        <Icon name="download" className="h-4 w-4" /> CSV
      </button>
      <button
        onClick={() => printPage()}
        title={tr(locale, { uz: "Chop etish", ru: "Печать", en: "Print" })}
        className="flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Icon name="copy" className="h-4 w-4" /> {tr(locale, { uz: "Chop etish", ru: "Печать", en: "Print" })}
      </button>
    </div>
  );
}
