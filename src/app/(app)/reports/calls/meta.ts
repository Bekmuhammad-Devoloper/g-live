// Holat / yo'nalish / qayta bog'lanish belgilari — jadval va kartalar uchun umumiy.
// Faqat ma'lumot obyektlari (funksiya emas), shuning uchun klient komponentlarda erkin ishlatiladi.

export interface Tri {
  uz: string;
  ru: string;
  en: string;
  de?: string;
}

export const STATUS: Record<string, { label: Tri; icon: string; tone: string }> = {
  ANSWERED: { label: { uz: "Javob berildi", ru: "Отвечен", en: "Answered", de: "Beantwortet" }, icon: "phoneCall", tone: "emerald" },
  MISSED: { label: { uz: "O'tkazib yuborilgan", ru: "Пропущен", en: "Missed", de: "Verpasst" }, icon: "phoneMissed", tone: "red" },
  NO_ANSWER: { label: { uz: "Javob yo'q", ru: "Нет ответа", en: "No answer", de: "Keine Antwort" }, icon: "phoneOff", tone: "slate" },
  BUSY: { label: { uz: "Band", ru: "Занято", en: "Busy", de: "Besetzt" }, icon: "phoneOff", tone: "orange" },
  FAILED: { label: { uz: "Xatolik", ru: "Ошибка", en: "Failed", de: "Fehler" }, icon: "alert", tone: "red" },
  CANCELLED: { label: { uz: "Bekor qilindi", ru: "Отменён", en: "Cancelled", de: "Storniert" }, icon: "close", tone: "slate" },
};

export const DIR: Record<string, { label: Tri; icon: string; tone: string }> = {
  INCOMING: { label: { uz: "Kiruvchi", ru: "Входящий", en: "Incoming", de: "Eingehend" }, icon: "arrowDownLeft", tone: "blue" },
  OUTGOING: { label: { uz: "Chiquvchi", ru: "Исходящий", en: "Outgoing", de: "Ausgehend" }, icon: "arrowUpRight", tone: "emerald" },
};

export const CALLBACK: Record<string, { label: Tri; icon: string; tone: string }> = {
  PENDING: { label: { uz: "Kutilmoqda", ru: "В ожидании", en: "Pending", de: "Ausstehend" }, icon: "clock", tone: "amber" },
  CALLED_BACK: { label: { uz: "Bog'lanildi", ru: "Перезвонили", en: "Called back", de: "Zurückgerufen" }, icon: "check", tone: "emerald" },
  NOT_NEEDED: { label: { uz: "Kerak emas", ru: "Не требуется", en: "Not needed", de: "Nicht nötig" }, icon: "close", tone: "slate" },
};

// Nishon (badge) ranglari
export const toneCls: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
  red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30",
  slate: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-600/40",
  orange: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/30",
  amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30",
  blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30",
};

// KPI plitkalari uchun kvadrat ikonka foni
export const sq: Record<string, string> = {
  blue: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  red: "bg-red-100 text-red-500 dark:bg-red-500/15 dark:text-red-400",
  indigo: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400",
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
  purple: "bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400",
};

export function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function hue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}
