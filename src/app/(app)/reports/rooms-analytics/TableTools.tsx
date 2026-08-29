"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { exportRows } from "@/lib/export";
import { type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";

const BASE = "/reports/rooms-analytics";

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
      title={tr(locale, { uz: "Saralash", ru: "Сортировка", en: "Sort", de: "Sortieren" })}
    >
      <span>{label}</span>
      <Icon
        name="arrow"
        className={`h-3 w-3 ${isActive ? "text-brand-500" : "text-slate-300 dark:text-slate-600"} ${isActive && dir === "asc" ? "rotate-180" : ""}`}
      />
    </button>
  );
}

export interface RoomRow {
  room: string;
  sessions: number;
  hours: number;
  days: number;
  groups: string[];
}

export function ExportButton({ rows, locale }: { rows: RoomRow[]; locale: Locale }) {
  const onClick = () => {
    exportRows(
      "xonalar-analitikasi",
      [
        { key: "room", label: tr(locale, { uz: "Xona", ru: "Кабинет", en: "Room", de: "Raum" }) },
        { key: "sessions", label: tr(locale, { uz: "Seanslar", ru: "Сеансы", en: "Sessions", de: "Sitzungen" }) },
        { key: "hours", label: tr(locale, { uz: "Soatlar", ru: "Часы", en: "Hours", de: "Stunden" }) },
        { key: "days", label: tr(locale, { uz: "Band kunlar", ru: "Занятых дней", en: "Busy days", de: "Belegte Tage" }) },
        { key: "groups", label: tr(locale, { uz: "Guruhlar", ru: "Группы", en: "Groups", de: "Gruppen" }) },
      ],
      rows.map((r) => ({ room: r.room, sessions: r.sessions, hours: r.hours, days: r.days, groups: r.groups.join("; ") })),
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
