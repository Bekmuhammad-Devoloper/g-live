// Tizim bo'ylab ishlatiladigan konstantalar va status-yorliqlari.
// (Enum o'rniga — SQLite/Postgres o'rtasida ko'chirishga qulay.)

export type Locale = "uz" | "ru" | "en";

export const LOCALES: Locale[] = ["uz", "ru", "en"];

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

export const ROLE_LABELS: Record<string, Record<Locale, string>> = {
  STUDENT: { uz: "O'quvchi", ru: "Ученик", en: "Student" },
  PARENT: { uz: "Ota-ona", ru: "Родитель", en: "Parent" },
  TEACHER: { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" },
  OPERATOR: { uz: "Operator", ru: "Оператор", en: "Operator" },
  ROP: { uz: "ROP (Sotuv bo'limi boshlig'i)", ru: "РОП (Начальник отдела продаж)", en: "ROP (Head of Sales)" },
  MANAGER: { uz: "Menejer", ru: "Менеджер", en: "Manager" },
  ACCOUNTANT: { uz: "Hisobchi", ru: "Бухгалтер", en: "Accountant" },
  DEPUTY_DIRECTOR: { uz: "Direktor o'rinbosari", ru: "Зам. директора", en: "Deputy Director" },
  DIRECTOR: { uz: "Direktor", ru: "Директор", en: "Director" },
  ADMIN: { uz: "Administrator", ru: "Администратор", en: "Administrator" },
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

export const LEAD_STAGE_LABELS: Record<string, Record<Locale, string>> = {
  NEW: { uz: "Yangi ariza", ru: "Новая заявка", en: "New lead" },
  IN_PROGRESS: { uz: "Ishda", ru: "В работе", en: "In progress" },
  CONTACTED: { uz: "Aloqa o'rnatildi", ru: "Связались", en: "Contacted" },
  TEST: { uz: "Test", ru: "Тест", en: "Test" },
  OFFER: { uz: "Taklif", ru: "Предложение", en: "Offer" },
  AWAITING_PAYMENT: { uz: "To'lov kutilmoqda", ru: "Ожидает оплаты", en: "Awaiting payment" },
  PAID: { uz: "To'landi", ru: "Оплачено", en: "Paid" },
  WON: { uz: "Qabul qilindi", ru: "Принят", en: "Won" },
  LOST: { uz: "Yo'qotildi", ru: "Потерян", en: "Lost" },
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

export const EDU_STATUS_LABELS: Record<string, Record<Locale, string>> = {
  WAITING: { uz: "Boshlanishni kutmoqda", ru: "Ожидает начала", en: "Waiting to start" },
  ACTIVE: { uz: "Faol", ru: "Активен", en: "Active" },
  FROZEN: { uz: "Muzlatilgan", ru: "Заморожен", en: "Frozen" },
  TRANSFERRED: { uz: "Ko'chirilgan", ru: "Переведён", en: "Transferred" },
  LEVEL_DONE: { uz: "Darajani tugatdi", ru: "Уровень завершён", en: "Level completed" },
  PROGRAM_DONE: { uz: "Dasturni tugatdi", ru: "Программа завершена", en: "Program completed" },
  EXPELLED: { uz: "Chetlashtirildi", ru: "Отчислен", en: "Expelled" },
  CERTIFIED: { uz: "Sertifikat berildi", ru: "Сертификат выдан", en: "Certified" },
  ARCHIVED: { uz: "Arxivlangan", ru: "В архиве", en: "Archived" },
};

// ─── To'lov ───
export const PAYMENT_METHODS = ["CASH", "CARD", "CLICK", "PAYME", "UZUM", "TRANSFER"] as const;
export const PAYMENT_STATUSES = ["PENDING", "PAID", "REFUNDED", "CANCELLED"] as const;

export const PAYMENT_STATUS_LABELS: Record<string, Record<Locale, string>> = {
  PENDING: { uz: "Kutilmoqda", ru: "Ожидает", en: "Pending" },
  PAID: { uz: "To'landi", ru: "Оплачено", en: "Paid" },
  REFUNDED: { uz: "Qaytarildi", ru: "Возврат", en: "Refunded" },
  CANCELLED: { uz: "Bekor qilindi", ru: "Отменён", en: "Cancelled" },
};

// ─── Davomat ───
export const ATTENDANCE_STATUSES = ["PRESENT", "LATE", "ABSENT", "EXCUSED", "ONLINE", "MAKEUP"] as const;

export const ATTENDANCE_STATUS_LABELS: Record<string, Record<Locale, string>> = {
  PRESENT: { uz: "Qatnashdi", ru: "Присутствовал", en: "Present" },
  LATE: { uz: "Kechikdi", ru: "Опоздал", en: "Late" },
  ABSENT: { uz: "Qatnashmadi", ru: "Отсутствовал", en: "Absent" },
  EXCUSED: { uz: "Uzrli", ru: "Уважительная", en: "Excused" },
  ONLINE: { uz: "Onlayn", ru: "Онлайн", en: "Online" },
  MAKEUP: { uz: "Qayta ishlash", ru: "Отработка", en: "Make-up" },
};

// ─── O'quv shakli (guruh/kurs formati) ───
export const GROUP_FORMATS = ["OFFLINE", "ONLINE", "HYBRID"] as const;

export const GROUP_FORMAT_LABELS: Record<string, Record<Locale, string>> = {
  OFFLINE: { uz: "Offline", ru: "Офлайн", en: "Offline" },
  ONLINE: { uz: "Onlayn", ru: "Онлайн", en: "Online" },
  HYBRID: { uz: "Aralash", ru: "Смешанный", en: "Hybrid" },
};

// ─── Mavsumiy baholash ───
export const SEASONS = ["WINTER", "SPRING", "SUMMER", "AUTUMN"] as const;

export const SEASON_LABELS: Record<string, Record<Locale, string>> = {
  WINTER: { uz: "Qish", ru: "Зима", en: "Winter" },
  SPRING: { uz: "Bahor", ru: "Весна", en: "Spring" },
  SUMMER: { uz: "Yoz", ru: "Лето", en: "Summer" },
  AUTUMN: { uz: "Kuz", ru: "Осень", en: "Autumn" },
};

export const ASSESSMENT_STATUSES = ["PLANNED", "ONGOING", "COMPLETED"] as const;

export const ASSESSMENT_STATUS_LABELS: Record<string, Record<Locale, string>> = {
  PLANNED: { uz: "Rejalashtirilgan", ru: "Запланировано", en: "Planned" },
  ONGOING: { uz: "Jarayonda", ru: "В процессе", en: "Ongoing" },
  COMPLETED: { uz: "Yakunlangan", ru: "Завершено", en: "Completed" },
};

// ─── Shartnoma (shablon turlari) ───
export const CONTRACT_TEMPLATE_TYPES = ["STANDARD", "ONLINE", "OFFLINE", "OFFER", "INDIVIDUAL"] as const;

export const CONTRACT_TEMPLATE_TYPE_LABELS: Record<string, Record<Locale, string>> = {
  STANDARD: { uz: "Standart", ru: "Стандартный", en: "Standard" },
  ONLINE: { uz: "Onlayn kurs", ru: "Онлайн-курс", en: "Online course" },
  OFFLINE: { uz: "Offline kurs", ru: "Офлайн-курс", en: "Offline course" },
  OFFER: { uz: "Ommaviy oferta", ru: "Публичная оферта", en: "Public offer" },
  INDIVIDUAL: { uz: "Individual", ru: "Индивидуальный", en: "Individual" },
};

export function label(
  map: Record<string, Record<Locale, string>>,
  key: string | null | undefined,
  locale: Locale
): string {
  if (!key) return "—";
  return map[key]?.[locale] ?? map[key]?.uz ?? key;
}

// Lavozim (User.position) ROP (sotuv bo'limi boshlig'i) ekanini aniqlaydi.
// ROP RBAC'da MANAGER'ga tushadi, lekin o'z portali (sidebar/dashboard) bo'lishi kerak.
export function isRopPosition(position: string | null | undefined): boolean {
  const p = (position ?? "").toLowerCase();
  return /\brop\b/.test(p) || (p.includes("sotuv") && (p.includes("boshli") || p.includes("rahbar") || p.includes("bo'lim") || p.includes("bo‘lim")));
}

// Intl uchun til kodi
export function intlLocale(locale: Locale): string {
  return locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ";
}

// Pulni formatlash (so'm) — deterministik: server va client bir xil chiqadi
// (Intl.NumberFormat lokali Node va brauzerda farq qilib, hydration xatosi berardi).
export function formatMoney(amount: number, locale: Locale = "uz"): string {
  const s = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const unit = locale === "ru" ? "сум" : locale === "en" ? "UZS" : "so'm";
  return `${s} ${unit}`;
}
