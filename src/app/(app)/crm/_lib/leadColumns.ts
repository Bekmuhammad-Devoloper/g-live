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
  label: { uz: string; ru: string; en: string };
  color: string; // hex — status rangi
  icon: string; // Icon nomi
  stages: string[];
  defaultStage: string; // shu ustunga tashlanganda beriladigan bosqich
}

export const COLUMNS: ColumnDef[] = [
  { key: "new", label: { uz: "Yangi", ru: "Новые", en: "New" }, color: "#3b82f6", icon: "download", stages: ["NEW"], defaultStage: "NEW" },
  { key: "work", label: { uz: "Ishda", ru: "В работе", en: "In progress" }, color: "#f59e0b", icon: "clock", stages: ["IN_PROGRESS", "CONTACTED"], defaultStage: "IN_PROGRESS" },
  { key: "offer", label: { uz: "Test / Taklif", ru: "Тест / Предложение", en: "Test / Offer" }, color: "#8b5cf6", icon: "filecheck", stages: ["TEST", "OFFER", "AWAITING_PAYMENT"], defaultStage: "OFFER" },
  { key: "won", label: { uz: "Qabul qilindi", ru: "Принят", en: "Won" }, color: "#10b981", icon: "check", stages: ["PAID", "WON"], defaultStage: "WON" },
  { key: "lost", label: { uz: "Yo'qotilgan", ru: "Потерян", en: "Lost" }, color: "#ef4444", icon: "personX", stages: ["LOST"], defaultStage: "LOST" },
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
