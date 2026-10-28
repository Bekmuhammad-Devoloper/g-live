type Cell = string | number | null | undefined;

function esc(v: Cell): string {
  const s = String(v ?? "");
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCsv(filename: string, headers: string[], rows: Cell[][]): void {
  const bom = "﻿";
  const lines = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
  const blob = new Blob([bom + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

export function exportRows<T extends object>(filename: string, columns: { key: string; label: string }[], data: readonly T[]): void {
  const recs = data as unknown as ReadonlyArray<Record<string, unknown>>;
  exportCsv(filename, columns.map((c) => c.label), recs.map((d) => columns.map((c) => d[c.key] as Cell)));
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printPage(): void {
  window.print();
}

export async function exportXlsx<T extends object>(
  filename: string,
  columns: { key: string; label: string; width?: number }[],
  data: readonly T[],
  sheetName = "Sheet1",
): Promise<void> {
  const XLSX = await import("xlsx");
  const recs = data as unknown as ReadonlyArray<Record<string, unknown>>;
  const aoa: Cell[][] = [columns.map((c) => c.label), ...recs.map((d) => columns.map((c) => d[c.key] as Cell))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = columns.map((c, i) => ({
    wch: c.width ?? Math.min(48, Math.max(10, ...aoa.slice(0, 200).map((r) => String(r[i] ?? "").length + 2))),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
