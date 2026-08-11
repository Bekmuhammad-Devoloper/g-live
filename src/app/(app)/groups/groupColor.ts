// Guruh rang palitrasi (rang tanlagichда va avto-rangда ishlatiladi)
export const GROUP_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#6366f1", "#84cc16", "#f97316"];

// Guruh rangi: qo'lда tanlangan bo'lsa — o'sha; bo'lmasa — id/nom bo'yicha barqaror avto-rang.
// Shu tufayli rang biriktirilmagan guruh ham jadvalда o'ziga xos rangда ko'rinadi.
export function groupColor(key: string, assigned?: string | null): string {
  if (assigned && /^#[0-9a-fA-F]{6}$/.test(assigned)) return assigned;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return GROUP_COLORS[h % GROUP_COLORS.length];
}
