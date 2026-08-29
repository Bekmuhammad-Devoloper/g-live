// Tizim bo'ylab ishlatiladigan konstantalar va status-yorliqlari.
// (Enum o'rniga — SQLite/Postgres o'rtasida ko'chirishga qulay.)

export type Locale = "uz" | "ru" | "en" | "de";

export const LOCALES: Locale[] = ["uz", "ru", "en", "de"];

// Bitta yozuvning 4 tildagi matni. Nemischa (de) IXTIYORIY — berilmagan
// joyda inglizchaga, u ham bo'lmasa o'zbekchaga tushadi (tr/label fallback).
// Shu tufayli eski 3 tilli obyektlar ham kompilyatsiyadan o'tadi.
export type LocaleText = { uz: string; ru: string; en: string; de?: string };

// ─── Rollar ───
export const ROLES = {
  STUDENT: "STUDENT",
  PARENT: "PARENT",
  TEACHER: "TEACHER",
  // Sotuv bo'limi — eski loyihadagidek IKKI ALOHIDA rol.
  // Ilgari ikkalasi ham MANAGER edi va ROP lavozim matni orqali ajratilardi.
  OPERATOR: "OPERATOR",
  ROP: "ROP",
  MANAGER: "MANAGER", // eski yozuvlar uchun qoldirilgan (yangi xodimga berilmaydi)
  ACCOUNTANT: "ACCOUNTANT",
  DEPUTY_DIRECTOR: "DEPUTY_DIRECTOR",
  DIRECTOR: "DIRECTOR",
  ADMIN: "ADMIN",
} as const;

/** Sotuv bo'limi rollari — "operator yoki ROP" tekshiruvlari uchun */
export const SALES_ROLES: string[] = [ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER];
export const isSalesRole = (r: string | null | undefined) => SALES_ROLES.includes(String(r));

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<string, LocaleText> = {
  STUDENT: { uz: "O'quvchi", ru: "Ученик", en: "Student", de: "Schüler" },
  PARENT: { uz: "Ota-ona", ru: "Родитель", en: "Parent", de: "Elternteil" },
  TEACHER: { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher", de: "Lehrer" },
  OPERATOR: { uz: "Operator", ru: "Оператор", en: "Operator", de: "Operator" },
  ROP: { uz: "ROP (Sotuv bo'limi boshlig'i)", ru: "РОП (Начальник отдела продаж)", en: "ROP (Head of Sales)", de: "ROP (Vertriebsleiter)" },
  MANAGER: { uz: "Menejer", ru: "Менеджер", en: "Manager", de: "Manager" },
  ACCOUNTANT: { uz: "Hisobchi", ru: "Бухгалтер", en: "Accountant", de: "Buchhalter" },
  DEPUTY_DIRECTOR: { uz: "Direktor o'rinbosari", ru: "Зам. директора", en: "Deputy Director", de: "Stellv. Direktor" },
  DIRECTOR: { uz: "Direktor", ru: "Директор", en: "Director", de: "Direktor" },
  ADMIN: { uz: "Administrator", ru: "Администратор", en: "Administrator", de: "Administrator" },
};

// ─── Lid voronka bosqichlari ───
export const LEAD_STAGES = [
  "NEW",
  "IN_PROGRESS",
  "CONTACTED",
  "TEST",
  "OFFER",
  "AWAITING_PAYMENT",
  "PAID",
  "WON",
  "LOST",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABELS: Record<string, LocaleText> = {
  NEW: { uz: "Yangi ariza", ru: "Новая заявка", en: "New lead", de: "Neue Anfrage" },
  IN_PROGRESS: { uz: "Ishda", ru: "В работе", en: "In progress", de: "In Bearbeitung" },
  CONTACTED: { uz: "Aloqa o'rnatildi", ru: "Связались", en: "Contacted", de: "Kontaktiert" },
  TEST: { uz: "Test", ru: "Тест", en: "Test", de: "Test" },
  OFFER: { uz: "Taklif", ru: "Предложение", en: "Offer", de: "Angebot" },
  AWAITING_PAYMENT: { uz: "To'lov kutilmoqda", ru: "Ожидает оплаты", en: "Awaiting payment", de: "Wartet auf Zahlung" },
  PAID: { uz: "To'landi", ru: "Оплачено", en: "Paid", de: "Bezahlt" },
  WON: { uz: "Qabul qilindi", ru: "Принят", en: "Won", de: "Aufgenommen" },
  LOST: { uz: "Yo'qotildi", ru: "Потерян", en: "Lost", de: "Verloren" },
};

// ─── Ta'lim statuslari ───
export const EDU_STATUSES = [
  "WAITING",
  "ACTIVE",
  "FROZEN",
  "TRANSFERRED",
  "LEVEL_DONE",
  "PROGRAM_DONE",
  "EXPELLED",
  "CERTIFIED",
  "ARCHIVED",
] as const;

export const EDU_STATUS_LABELS: Record<string, LocaleText> = {
  WAITING: { uz: "Boshlanishni kutmoqda", ru: "Ожидает начала", en: "Waiting to start", de: "Wartet auf Start" },
  ACTIVE: { uz: "Faol", ru: "Активен", en: "Active", de: "Aktiv" },
  FROZEN: { uz: "Muzlatilgan", ru: "Заморожен", en: "Frozen", de: "Pausiert" },
  TRANSFERRED: { uz: "Ko'chirilgan", ru: "Переведён", en: "Transferred", de: "Versetzt" },
  LEVEL_DONE: { uz: "Darajani tugatdi", ru: "Уровень завершён", en: "Level completed", de: "Stufe abgeschlossen" },
  PROGRAM_DONE: { uz: "Dasturni tugatdi", ru: "Программа завершена", en: "Program completed", de: "Programm abgeschlossen" },
  EXPELLED: { uz: "Chetlashtirildi", ru: "Отчислен", en: "Expelled", de: "Ausgeschlossen" },
  CERTIFIED: { uz: "Sertifikat berildi", ru: "Сертификат выдан", en: "Certified", de: "Zertifiziert" },
  ARCHIVED: { uz: "Arxivlangan", ru: "В архиве", en: "Archived", de: "Archiviert" },
};

// ─── To'lov ───
// "BANK" — bank hisobiga o'tkazma (xarajatlar ro'yxatida allaqachon bor edi,
// endi kirim to'lovlarida ham tanlanadi).
export const PAYMENT_METHODS = ["CASH", "CARD", "BANK", "CLICK", "PAYME", "UZUM", "TRANSFER"] as const;

export const PAYMENT_METHOD_LABELS: Record<string, LocaleText> = {
  CASH: { uz: "Naqd", ru: "Наличные", en: "Cash", de: "Bargeld" },
  CARD: { uz: "Karta", ru: "Карта", en: "Card", de: "Karte" },
  BANK: { uz: "Bank hisobi", ru: "Банковский счёт", en: "Bank account", de: "Bankkonto" },
  CLICK: { uz: "Click", ru: "Click", en: "Click", de: "Click" },
  PAYME: { uz: "Payme", ru: "Payme", en: "Payme", de: "Payme" },
  UZUM: { uz: "Uzum", ru: "Uzum", en: "Uzum", de: "Uzum" },
  TRANSFER: { uz: "O'tkazma", ru: "Перевод", en: "Transfer", de: "Überweisung" },
  HUMO: { uz: "Humo", ru: "Humo", en: "Humo", de: "Humo" },
};
export const PAYMENT_STATUSES = ["PENDING", "PAID", "REFUNDED", "CANCELLED"] as const;

export const PAYMENT_STATUS_LABELS: Record<string, LocaleText> = {
  PENDING: { uz: "Kutilmoqda", ru: "Ожидает", en: "Pending", de: "Ausstehend" },
  PAID: { uz: "To'landi", ru: "Оплачено", en: "Paid", de: "Bezahlt" },
  REFUNDED: { uz: "Qaytarildi", ru: "Возврат", en: "Refunded", de: "Erstattet" },
  CANCELLED: { uz: "Bekor qilindi", ru: "Отменён", en: "Cancelled", de: "Storniert" },
};

// ─── Davomat ───
export const ATTENDANCE_STATUSES = ["PRESENT", "LATE", "ABSENT", "EXCUSED", "ONLINE", "MAKEUP"] as const;

export const ATTENDANCE_STATUS_LABELS: Record<string, LocaleText> = {
  PRESENT: { uz: "Qatnashdi", ru: "Присутствовал", en: "Present", de: "Anwesend" },
  LATE: { uz: "Kechikdi", ru: "Опоздал", en: "Late", de: "Verspätet" },
  ABSENT: { uz: "Qatnashmadi", ru: "Отсутствовал", en: "Absent", de: "Abwesend" },
  EXCUSED: { uz: "Uzrli", ru: "Уважительная", en: "Excused", de: "Entschuldigt" },
  ONLINE: { uz: "Onlayn", ru: "Онлайн", en: "Online", de: "Online" },
  MAKEUP: { uz: "Qayta ishlash", ru: "Отработка", en: "Make-up", de: "Nachholstunde" },
};

// ─── O'quv shakli (guruh/kurs formati) ───
export const GROUP_FORMATS = ["OFFLINE", "ONLINE", "HYBRID"] as const;

export const GROUP_FORMAT_LABELS: Record<string, LocaleText> = {
  OFFLINE: { uz: "Offline", ru: "Офлайн", en: "Offline", de: "Präsenz" },
  ONLINE: { uz: "Onlayn", ru: "Онлайн", en: "Online", de: "Online" },
  HYBRID: { uz: "Aralash", ru: "Смешанный", en: "Hybrid", de: "Hybrid" },
};

// ─── Mavsumiy baholash ───
export const SEASONS = ["WINTER", "SPRING", "SUMMER", "AUTUMN"] as const;

export const SEASON_LABELS: Record<string, LocaleText> = {
  WINTER: { uz: "Qish", ru: "Зима", en: "Winter", de: "Winter" },
  SPRING: { uz: "Bahor", ru: "Весна", en: "Spring", de: "Frühling" },
  SUMMER: { uz: "Yoz", ru: "Лето", en: "Summer", de: "Sommer" },
  AUTUMN: { uz: "Kuz", ru: "Осень", en: "Autumn", de: "Herbst" },
};

export const ASSESSMENT_STATUSES = ["PLANNED", "ONGOING", "COMPLETED"] as const;

export const ASSESSMENT_STATUS_LABELS: Record<string, LocaleText> = {
  PLANNED: { uz: "Rejalashtirilgan", ru: "Запланировано", en: "Planned", de: "Geplant" },
  ONGOING: { uz: "Jarayonda", ru: "В процессе", en: "Ongoing", de: "Laufend" },
  COMPLETED: { uz: "Yakunlangan", ru: "Завершено", en: "Completed", de: "Abgeschlossen" },
};

// ─── Shartnoma (shablon turlari) ───
export const CONTRACT_TEMPLATE_TYPES = ["STANDARD", "ONLINE", "OFFLINE", "OFFER", "INDIVIDUAL"] as const;

export const CONTRACT_TEMPLATE_TYPE_LABELS: Record<string, LocaleText> = {
  STANDARD: { uz: "Standart", ru: "Стандартный", en: "Standard", de: "Standard" },
  ONLINE: { uz: "Onlayn kurs", ru: "Онлайн-курс", en: "Online course", de: "Online-Kurs" },
  OFFLINE: { uz: "Offline kurs", ru: "Офлайн-курс", en: "Offline course", de: "Präsenzkurs" },
  OFFER: { uz: "Ommaviy oferta", ru: "Публичная оферта", en: "Public offer", de: "Öffentliches Angebot" },
  INDIVIDUAL: { uz: "Individual", ru: "Индивидуальный", en: "Individual", de: "Individuell" },
};

export function label(
  map: Record<string, LocaleText>,
  key: string | null | undefined,
  locale: Locale
): string {
  if (!key) return "—";
  return map[key]?.[locale] ?? map[key]?.en ?? map[key]?.uz ?? key;
}

// Lavozim (User.position) ROP (sotuv bo'limi boshlig'i) ekanini aniqlaydi.
// ROP RBAC'da MANAGER'ga tushadi, lekin o'z portali (sidebar/dashboard) bo'lishi kerak.
export function isRopPosition(position: string | null | undefined): boolean {
  const p = (position ?? "").toLowerCase();
  return /\brop\b/.test(p) || (p.includes("sotuv") && (p.includes("boshli") || p.includes("rahbar") || p.includes("bo'lim") || p.includes("bo‘lim")));
}

// Intl uchun til kodi
export function intlLocale(locale: Locale): string {
  return locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : locale === "de" ? "de-DE" : "uz-UZ";
}

// Pulni formatlash (so'm) — deterministik: server va client bir xil chiqadi
// (Intl.NumberFormat lokali Node va brauzerda farq qilib, hydration xatosi berardi).
export function formatMoney(amount: number, locale: Locale = "uz"): string {
  const s = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const unit = locale === "ru" ? "сум" : locale === "en" || locale === "de" ? "UZS" : "so'm";
  return `${s} ${unit}`;
}
