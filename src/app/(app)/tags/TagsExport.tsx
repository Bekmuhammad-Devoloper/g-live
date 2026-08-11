"use client";

import { exportRows } from "@/lib/export";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";

export interface TagRow { id: string; name: string; code: string; active: string }

export default function TagsExport({ rows, locale }: { rows: TagRow[]; locale: Locale }) {
  const exportCsvNow = () =>
    exportRows(
      tr(locale, { uz: "teglar", ru: "теги", en: "tags" }),
      [
        { key: "name", label: tr(locale, { uz: "Nomi", ru: "Название", en: "Name" }) },
        { key: "code", label: tr(locale, { uz: "Kodi", ru: "Код", en: "Code" }) },
        { key: "active", label: tr(locale, { uz: "Holati", ru: "Статус", en: "Status" }) },
      ],
      rows.map((t) => ({ name: t.name, code: t.code, active: t.active })),
    );

  return (
    <div className="flex justify-end">
      <button
        onClick={exportCsvNow}
        className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/60"
        title={tr(locale, { uz: "CSV yuklab olish", ru: "Скачать CSV", en: "Download CSV" })}
      >
        <Icon name="download" className="h-4 w-4" /> {tr(locale, { uz: "Eksport", ru: "Экспорт", en: "Export" })}
      </button>
    </div>
  );
}
