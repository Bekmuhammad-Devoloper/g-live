"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { exportRows } from "@/lib/export";
import { Icon } from "../../_components/Icon";

const BASE = "/reports/teacher-performance";

/** Ustun sarlavhasi — bosilganda saralaydi (URL orqali). */
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
      className={`inline-flex items-center gap-1 hover:text-brand-600 dark:hover:text-brand-300 ${className ?? ""}`}
      title={tr(locale, { uz: "Saralash", ru: "Сортировка", en: "Sort" })}
    >
      <span>{label}</span>
      <Icon
        name="arrow"
        className={`h-3 w-3 transition ${isActive ? "text-brand-500" : "text-slate-300 dark:text-slate-600"} ${isActive && dir === "asc" ? "rotate-180" : ""}`}
      />
    </button>
  );
}

export interface TeacherRow {
  name: string;
  s_active: number; s_left: number; s_grad: number; s_frozen: number;
  c_active: number; c_left: number; c_grad: number; c_frozen: number;
  e_active: number; e_left: number; e_grad: number; e_frozen: number;
}

/** Ko'rinib turgan qatorlardan CSV yuklab beradi. */
export function ExportButton({ rows, locale }: { rows: TeacherRow[]; locale: Locale }) {
  const onClick = () => {
    const boshi = tr(locale, { uz: "Boshi", ru: "Начало", en: "Start" });
    const ozgarish = tr(locale, { uz: "O'zgarish", ru: "Изменение", en: "Change" });
    const oxiri = tr(locale, { uz: "Oxiri", ru: "Конец", en: "End" });
    const aktiv = tr(locale, { uz: "Aktiv", ru: "Активные", en: "Active" });
    const ketganlar = tr(locale, { uz: "Ketganlar", ru: "Ушедшие", en: "Left" });
    const bitirganlar = tr(locale, { uz: "Bitirganlar", ru: "Выпускники", en: "Graduated" });
    const muzlatilgan = tr(locale, { uz: "Muzlatilgan", ru: "Замороженные", en: "Frozen" });
    exportRows(
      "oqituvchilar-samaradorligi",
      [
        { key: "name", label: tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" }) },
        { key: "s_active", label: `${boshi}: ${aktiv}` },
        { key: "s_left", label: `${boshi}: ${ketganlar}` },
        { key: "s_grad", label: `${boshi}: ${bitirganlar}` },
        { key: "s_frozen", label: `${boshi}: ${muzlatilgan}` },
        { key: "c_active", label: `${ozgarish}: ${aktiv}` },
        { key: "c_left", label: `${ozgarish}: ${ketganlar}` },
        { key: "c_grad", label: `${ozgarish}: ${bitirganlar}` },
        { key: "c_frozen", label: `${ozgarish}: ${muzlatilgan}` },
        { key: "e_active", label: `${oxiri}: ${aktiv}` },
        { key: "e_left", label: `${oxiri}: ${ketganlar}` },
        { key: "e_grad", label: `${oxiri}: ${bitirganlar}` },
        { key: "e_frozen", label: `${oxiri}: ${muzlatilgan}` },
      ],
      rows as unknown as Record<string, string | number>[],
    );
  };
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
