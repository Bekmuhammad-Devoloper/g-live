// Client-side eksport yordamchilari (CSV yuklab olish va chop etish).
// Faqat brauzerda, event handler ichida chaqiriladi (server komponentda emas).

type Cell = string | number | null | undefined;

function esc(v: Cell): string {
  const s = String(v ?? "");
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Sarlavha + qatorlardan CSV yasab yuklab beradi (Excel UTF-8 mos). */
export function exportCsv(filename: string, headers: string[], rows: Cell[][]): void {
  const bom = "﻿";
  const lines = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
  const blob = new Blob([bom + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

/** Obyektlar ro'yxatidan CSV — ustunlar {key,label} bo'yicha.
 *  Generic: har qanday interfeys/tur massivini qabul qiladi (index-signature shart emas). */
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

/** Joriy sahifani chop etish oynasi. */
export function printPage(): void {
  window.print();
}
