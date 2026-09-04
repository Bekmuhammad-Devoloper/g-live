// Lead workspace — ustunlar konfiguratsiyasi va turlari.
// 9 bosqich (LEAD_STAGES) 5 Kanban ustuniga yig'iladi.

export interface VLead {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  source: string | null;
  stage: string;
  interestCourse: string | null;
  age: number | null;
  level: string | null;
  budget: number | null;
  note: string | null;
  managerId: string | null;
  managerName: string | null;
  studentId: string | null;
  /** Yo'naltirilgan guruh (WON uchun majburiy) */
  groupId: string | null;
  groupName: string | null;
  /** Guruh necha marta o'zgartirilgan (1 dan keyin bloklanadi) */
  enrollEditCount: number;
  activityCount: number;
  lastActivity: string | null;
  createdAt: string; // ISO
}

export interface ColumnDef {
  key: string;
  label: { uz: string; ru: string; en: string; de?: string };
  color: string; // hex — status rangi
  icon: string; // Icon nomi
  stages: string[];
  defaultStage: string; // shu ustunga tashlanganda beriladigan bosqich
}

export const COLUMNS: ColumnDef[] = [
  { key: "new", label: { uz: "Yangi", ru: "Новые", en: "New", de: "Neu" }, color: "#3b82f6", icon: "download", stages: ["NEW"], defaultStage: "NEW" },
  { key: "work", label: { uz: "Ishda", ru: "В работе", en: "In progress", de: "In Arbeit" }, color: "#f59e0b", icon: "clock", stages: ["IN_PROGRESS", "CONTACTED"], defaultStage: "IN_PROGRESS" },
  { key: "offer", label: { uz: "Test / Taklif", ru: "Тест / Предложение", en: "Test / Offer", de: "Test / Angebot" }, color: "#8b5cf6", icon: "filecheck", stages: ["TEST", "OFFER", "AWAITING_PAYMENT"], defaultStage: "OFFER" },
  { key: "won", label: { uz: "Qabul qilindi", ru: "Принят", en: "Won", de: "Aufgenommen" }, color: "#10b981", icon: "check", stages: ["PAID", "WON"], defaultStage: "WON" },
  { key: "lost", label: { uz: "Yo'qotilgan", ru: "Потерян", en: "Lost", de: "Verloren" }, color: "#ef4444", icon: "personX", stages: ["LOST"], defaultStage: "LOST" },
];

const STAGE_TO_COLUMN: Record<string, string> = {};
for (const c of COLUMNS) for (const st of c.stages) STAGE_TO_COLUMN[st] = c.key;

export function columnOf(stage: string): string {
  return STAGE_TO_COLUMN[stage] ?? "new";
}

export function columnDef(key: string): ColumnDef {
  return COLUMNS.find((c) => c.key === key) ?? COLUMNS[0];
}

export function colorOfStage(stage: string): string {
  return columnDef(columnOf(stage)).color;
}

// Bosqich o'zgarishi ruxsatlari (soddalashtirilgan — bizning tizim moslashuvchan).
// Faqat bitta qoida: bir ustundan boshqasiga o'tkazish mumkin.
export function canTransition(fromStage: string, toColumnKey: string): boolean {
  return columnOf(fromStage) !== toColumnKey;
}

export function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/* ─── Guruh ustunlari ────────────────────────────────────────────────
   Direktor/administrator guruhni Kanbanga "biriktirsa", shu guruh uchun
   alohida ustun paydo bo'ladi. Ustunga tashlangan lid o'sha guruhga
   yoziladi va "Qabul qilindi" bosqichiga o'tadi.                       */

export interface GroupColumn {
  groupId: string;
  name: string;
  /** Kurs nomi — ustun tagida ko'rsatiladi */
  program: string | null;
  color: string;
  icon: string;
}

export const GROUP_COL_PREFIX = "grp:";

export function groupColKey(groupId: string): string {
  return GROUP_COL_PREFIX + groupId;
}

export function isGroupCol(key: string): boolean {
  return key.startsWith(GROUP_COL_PREFIX);
}

export function groupIdOfCol(key: string): string {
  return key.slice(GROUP_COL_PREFIX.length);
}

/**
 * Lid qaysi ustunda ko'rinadi. Qabul qilingan lidning guruhi Kanbanga
 * biriktirilgan bo'lsa — o'sha guruh ustunida, aks holda "Qabul qilindi"da.
 */
export function columnOfLead(lead: { stage: string; groupId: string | null }, pinned: Set<string>): string {
  const base = columnOf(lead.stage);
  if (base === "won" && lead.groupId && pinned.has(lead.groupId)) return groupColKey(lead.groupId);
  return base;
}

/** Ustun uchun tayyor ranglar — Kanban sarlavhasi shu rangda bo'ladi */
export const GROUP_COL_COLORS = [
  "#10b981", "#0ea5e9", "#6366f1", "#a855f7",
  "#ec4899", "#f97316", "#eab308", "#14b8a6",
];

/** Ustun uchun tayyor belgilar (Icon nomlari) */
export const GROUP_COL_ICONS = [
  "layers", "graduation", "users", "book",
  "trophy", "award", "calendar", "globe",
];
