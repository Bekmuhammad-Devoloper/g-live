// Lead workspace — ustunlar konfiguratsiyasi va turlari.
// 9 bosqich (LEAD_STAGES) 6 Kanban ustuniga yig'iladi.

export interface VLead {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  /** Telegram username (@user) — onlayn arizadan */
  telegram: string | null;
  /** Ta'lim shakli: ONLINE | OFFLINE — arizadan */
  studyFormat: string | null;
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
  /** Filial (ROP kanbanida filial ustuni shu bo'yicha) */
  branchId: string | null;
  branchName: string | null;
  /** Filial ustunidagi bo'sh xona/vaqt kartasi — lid shu xonaga tashlangan */
  branchSlotId: string | null;
  /** Yo'naltirilgan guruh (WON uchun majburiy) */
  groupId: string | null;
  groupName: string | null;
  /** Guruh necha marta o'zgartirilgan (1 dan keyin bloklanadi) */
  enrollEditCount: number;
  /** Oddiy nomli Kanban ustuni (bo'lsa — lid shu ustunda ko'rinadi) */
  kanbanColumnId: string | null;
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
  // Daraja testi — sarlavhasida QR tugmasi bor (lid skan qilib test saytiga o'tadi)
  { key: "test", label: { uz: "Daraja testi", ru: "Тест уровня", en: "Level test", de: "Einstufungstest" }, color: "#06b6d4", icon: "clipboard", stages: ["TEST"], defaultStage: "TEST" },
  { key: "offer", label: { uz: "Taklif", ru: "Предложение", en: "Offer", de: "Angebot" }, color: "#8b5cf6", icon: "filecheck", stages: ["OFFER", "AWAITING_PAYMENT"], defaultStage: "OFFER" },
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

/* ─── Oddiy nomli ustunlar ───────────────────────────────────────────
   Guruhga bog'lanmagan, o'z nomi bilan yaratilgan ustun ("Sentyabr oqimi",
   "VIP" ...). Lid tashlansa shu ustunga o'tadi, bosqichi o'zgarmaydi;
   standart ustunga qaytarilsa yoki guruhga yozilsa ustundan chiqadi.      */

export interface CustomColumn {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export const CUSTOM_COL_PREFIX = "col:";

export function customColKey(id: string): string {
  return CUSTOM_COL_PREFIX + id;
}

export function isCustomCol(key: string): boolean {
  return key.startsWith(CUSTOM_COL_PREFIX);
}

export function customIdOfCol(key: string): string {
  return key.slice(CUSTOM_COL_PREFIX.length);
}

const EMPTY = new Set<string>();

/* ─── Filial ustunlari (ROP kanbani) ─────────────────────────────────
   Filiallar ustun bo'lib turadi (Qibray, Oybek ...). Filial ustunida FAQAT
   ROP/admin qo'li bilan shu ustunga tashlagan lidlar ko'rinadi — belgi
   Lead.kanbanColumnId = "br:<filialId>" (bosqichdan mustaqil; boshqa ustunga
   ko'chirilsa tozalanadi). Qolgan lidlar o'z bosqichi ustunida. Ustun tepasida
   filial administratori kiritgan bo'sh xona/vaqtlar turadi.                */

export interface BranchSlotView { id: string; branchId: string; room: string; days: string; startTime: string; endTime: string; note: string | null; capacity: number | null }
export interface BranchColumn { branchId: string; name: string; color: string; slots: BranchSlotView[] }

export const BRANCH_COL_PREFIX = "br:";
export const branchColKey = (branchId: string) => BRANCH_COL_PREFIX + branchId;
export const isBranchCol = (key: string) => key.startsWith(BRANCH_COL_PREFIX);
/** "br:<filial>" yoki "br:<filial>:<xona>" → filial id */
export const branchIdOfCol = (key: string) => key.slice(BRANCH_COL_PREFIX.length).split(":")[0];
/** "br:<filial>:<xona>" → xona (slot) id; ustunning o'ziga tashlansa null */
export const slotIdOfCol = (key: string): string | null => key.slice(BRANCH_COL_PREFIX.length).split(":")[1] ?? null;
/** Xona kartasiga tashlash uchun drop kaliti */
export const slotDropKey = (branchId: string, slotId: string) => `${BRANCH_COL_PREFIX}${branchId}:${slotId}`;

/**
 * Filial rejimi (kim ko'rayotganiga qarab):
 *   "sales" — ROP va filial administratori: "Daraja testi" va "Taklif" ustunlari yo'q —
 *             o'sha bosqichdagi (filialga tashlanmagan) lidlar "Yangi"da turadi;
 *             filial ustunida faqat qo'lda tashlanganlar.
 *   "head"  — direktor / o'rinbosar: HAMMA ustunlar — Yangi, Ishda, Daraja testi,
 *             Taklif, filiallar, Qabul qilindi, Yo'qotilgan.
 */
export type BranchMode = "sales" | "head";
/** `online: false` — "Onlayn" ustuni ko'rsatilmaydi (filial administratori — onlayn lidlar unga tegishli emas) */
export interface BranchModeCfg { ids: Set<string>; mode: BranchMode; online: boolean }

/** "Onlayn" ustuni — arizada onlayn tanlagan (studyFormat=ONLINE) yangi lidlar; filiallardan oldin turadi */
export const ONLINE_COL = "online";

/** Rejimda ko'rsatilmaydigan standart ustunlar (filtr chiplarida ham yashiriladi) */
export function branchReplaces(mode: BranchMode): Set<string> {
  return mode === "sales" ? new Set(["test", "offer"]) : new Set();
}

/**
 * Lid qaysi ustunda ko'rinadi:
 *   1) oddiy nomli ustunga qo'yilgan bo'lsa (va ustun hali bor) — o'sha ustunda;
 *   2) qabul qilingan lidning guruhi Kanbanga biriktirilgan bo'lsa — guruh ustunida;
 *   3) filial rejimida (ROP) test/taklif bosqichidagi lid — o'z filialining ustunida;
 *   4) aks holda bosqichiga mos standart ustunda.
 */
export function columnOfLead(
  lead: { stage: string; groupId: string | null; kanbanColumnId?: string | null; branchId?: string | null; studyFormat?: string | null },
  pinned: Set<string>,
  custom: Set<string> = EMPTY,
  branch: BranchModeCfg | null = null,
): string {
  // Qo'lda filial ustuniga tashlangan — belgi "br:<id>" (filial rejimi bo'lsa va filial hali bor)
  if (branch && lead.kanbanColumnId && isBranchCol(lead.kanbanColumnId) && branch.ids.has(branchIdOfCol(lead.kanbanColumnId))) {
    return lead.kanbanColumnId;
  }
  if (lead.kanbanColumnId && custom.has(lead.kanbanColumnId)) return customColKey(lead.kanbanColumnId);
  const base = columnOf(lead.stage);
  if (base === "won" && lead.groupId && pinned.has(lead.groupId)) return groupColKey(lead.groupId);
  if (branch) {
    // Sotuv rejimida test/taklif ustunlari yo'q — o'sha bosqichdagilar "Yangi" hisoblanadi
    const eff = branch.mode === "sales" && (base === "test" || base === "offer") ? "new" : base;
    // Onlayn tanlaganlar Yangiga emas — alohida "Onlayn" ustuniga
    if (eff === "new" && lead.studyFormat === "ONLINE" && branch.online) return ONLINE_COL;
    return eff;
  }
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
