"use client";

import { exportRows } from "@/lib/export";
import { type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../_components/Icon";

export interface AuditRow {
  date: string;
  entity: string;
  action: string;
  actor: string;
  phone: string;
  reason: string;
}

export default function AuditExport({ rows, locale }: { rows: AuditRow[]; locale: Locale }) {
  const doExport = () => {
    exportRows(
      "audit_jurnali",
      [
        { key: "date", label: tr(locale, { uz: "Sana", ru: "Дата", en: "Date" }) },
        { key: "entity", label: tr(locale, { uz: "Obyekt", ru: "Объект", en: "Object" }) },
        { key: "action", label: tr(locale, { uz: "Amal", ru: "Действие", en: "Action" }) },
        { key: "actor", label: tr(locale, { uz: "Xodim", ru: "Сотрудник", en: "Staff" }) },
        { key: "phone", label: tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone" }) },
        { key: "reason", label: tr(locale, { uz: "Izoh", ru: "Комментарий", en: "Comment" }) },
      ],
      rows,
    );
  };

  return (
    <button
      type="button"
      onClick={doExport}
      disabled={rows.length === 0}
      className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
    >
      <Icon name="download" className="h-4 w-4" />
      {tr(locale, { uz: "Eksport", ru: "Экспорт", en: "Export" })}
    </button>
  );
}
