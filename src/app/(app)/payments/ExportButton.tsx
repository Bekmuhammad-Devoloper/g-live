"use client";

import { exportRows } from "@/lib/export";

type Cell = string | number | null | undefined;

// Sahifada allaqachon ko'rsatilgan qatorlardan CSV eksport qiladi.
export default function ExportButton({
  rows,
  columns,
  filename,
  label,
}: {
  rows: Record<string, Cell>[];
  columns: { key: string; label: string }[];
  filename: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => exportRows(filename, columns, rows)}
      disabled={rows.length === 0}
      className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
    >
      ⬇ {label}
    </button>
  );
}
