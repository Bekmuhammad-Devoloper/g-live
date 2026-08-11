"use client";

import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { exportRows } from "@/lib/export";
import { Icon } from "../../_components/Icon";

export interface LeftRow {
  name: string;
  phone: string;
  group: string;
  teacher: string;
  course: string;
  date: string;
}

export default function LeftExport({ rows, locale }: { rows: LeftRow[]; locale: Locale }) {
  const doExport = () => {
    exportRows(
      "guruhni_tark_etganlar",
      [
        { key: "n", label: "№" },
        { key: "name", label: tr(locale, { uz: "O'quvchi", ru: "Ученик", en: "Student" }) },
        { key: "phone", label: tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone" }) },
        { key: "group", label: tr(locale, { uz: "Guruh", ru: "Группа", en: "Group" }) },
        { key: "teacher", label: tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" }) },
        { key: "course", label: tr(locale, { uz: "Kurs", ru: "Курс", en: "Course" }) },
        { key: "date", label: tr(locale, { uz: "Sana", ru: "Дата", en: "Date" }) },
      ],
      rows.map((r, i) => ({ n: i + 1, ...r })),
    );
  };

  return (
    <button
      type="button"
      onClick={doExport}
      disabled={rows.length === 0}
      className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
    >
      <Icon name="download" className="h-4 w-4" />
      {tr(locale, { uz: "Eksport", ru: "Экспорт", en: "Export" })}
    </button>
  );
}
