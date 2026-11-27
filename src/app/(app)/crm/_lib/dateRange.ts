export const DATE_PRESETS: { key: string; label: { uz: string; ru: string; en: string; de?: string } }[] = [
  { key: "today", label: { uz: "Bugun", ru: "Сегодня", en: "Today", de: "Heute" } },
  { key: "yesterday", label: { uz: "Kecha", ru: "Вчера", en: "Yesterday", de: "Gestern" } },
  { key: "7d", label: { uz: "Oxirgi 7 kun", ru: "Последние 7 дней", en: "Last 7 days", de: "Letzte 7 Tage" } },
  { key: "30d", label: { uz: "Oxirgi 30 kun", ru: "Последние 30 дней", en: "Last 30 days", de: "Letzte 30 Tage" } },
  { key: "month", label: { uz: "Shu oy", ru: "Этот месяц", en: "This month", de: "Dieser Monat" } },
  { key: "prevmonth", label: { uz: "O'tgan oy", ru: "Прошлый месяц", en: "Last month", de: "Letzter Monat" } },
  { key: "year", label: { uz: "Shu yil", ru: "Этот год", en: "This year", de: "Dieses Jahr" } },
];

const pad = (n: number) => String(n).padStart(2, "0");

export const isoDay = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const dotDay = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};

export function parseIsoDay(v: string): number | null {
  const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return r ? new Date(+r[1], +r[2] - 1, +r[3]).getTime() : null;
}

export function leadDateRange(preset: string, from: string, to: string, now = new Date()): { start: number; end: number } | null {
  const day = (y: number, m: number, d: number) => new Date(y, m, d).getTime();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  switch (preset) {
    case "today": return { start: day(y, m, d), end: day(y, m, d + 1) };
    case "yesterday": return { start: day(y, m, d - 1), end: day(y, m, d) };
    case "7d": return { start: day(y, m, d - 6), end: day(y, m, d + 1) };
    case "30d": return { start: day(y, m, d - 29), end: day(y, m, d + 1) };
    case "month": return { start: day(y, m, 1), end: day(y, m + 1, 1) };
    case "prevmonth": return { start: day(y, m - 1, 1), end: day(y, m, 1) };
    case "year": return { start: day(y, 0, 1), end: day(y + 1, 0, 1) };
    case "custom": {
      let a = parseIsoDay(from), b = parseIsoDay(to);
      if (a === null && b === null) return null;
      if (a !== null && b !== null && a > b) [a, b] = [b, a];
      if (b === null) return { start: a as number, end: Infinity };
      const e = new Date(b);
      return { start: a ?? -Infinity, end: day(e.getFullYear(), e.getMonth(), e.getDate() + 1) };
    }
    default: return null;
  }
}
