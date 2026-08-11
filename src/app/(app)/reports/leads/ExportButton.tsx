"use client";

import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { exportRows } from "@/lib/export";
import { Icon } from "../../_components/Icon";

interface Row {
  label: string;
  value: number;
}

// Lidlar hisobotini (oylar kesimida) CSV'ga eksport qiladi.
export default function ExportButton({ filename, rows, locale }: { filename: string; rows: Row[]; locale: Locale }) {
  const handleExport = () => {
    exportRows(
      filename,
      [
        { key: "label", label: tr(locale, { uz: "Oy", ru: "Месяц", en: "Month" }) },
        { key: "value", label: tr(locale, { uz: "Lidlar soni", ru: "Количество лидов", en: "Number of leads" }) },
      ],
      rows
    );
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className="flex h-10 items-center gap-2 rounded-full border border-brand-200 px-5 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 dark:border-brand-500/40 dark:text-brand-300 dark:hover:bg-brand-950/40"
    >
      <Icon name="download" className="h-4 w-4" /> {tr(locale, { uz: "Eksport", ru: "Экспорт", en: "Export" })}
    </button>
  );
}
