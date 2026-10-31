import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";

export interface VLead {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  telegram: string | null;
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
  branchId: string | null;
  branchName: string | null;
  branchSlotId: string | null;
  archivedAt: string | null;
  archiveKind: string | null;
  testSet: string | null;
  testLevel: string | null;
  testPct: number | null;
  testPassed: boolean | null;
  groupId: string | null;
  groupName: string | null;
  enrollEditCount: number;
  debt?: number;
  debtMonths?: number;
  credit?: number;
  kanbanColumnId: string | null;
  activityCount: number;
  lastActivity: string | null;
  lostBy: string | null;
  lostAt: string | null;
  lossReason: string | null;
  createdAt: string;
}

export interface ColumnDef {
  key: string;
  label: { uz: string; ru: string; en: string; de?: string };
  color: string;
  icon: string;
  stages: string[];
  defaultStage: string;
}

export const COLUMNS: ColumnDef[] = [
  { key: "new", label: { uz: "Yangi", ru: "Новые", en: "New", de: "Neu" }, color: "#3b82f6", icon: "download", stages: ["NEW"], defaultStage: "NEW" },
  { key: "work", label: { uz: "Ishda", ru: "В работе", en: "In progress", de: "In Arbeit" }, color: "#f59e0b", icon: "clock", stages: ["IN_PROGRESS", "CONTACTED"], defaultStage: "IN_PROGRESS" },
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

export function canTransition(fromStage: string, toColumnKey: string): boolean {
  return columnOf(fromStage) !== toColumnKey;
}

export function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export interface GroupColumn {
  groupId: string;
  name: string;
  program: string | null;
  color: string;
  icon: string;
}

export interface GroupInfo {
  students: number;
  capacity: number;
  room: string | null;
  schedule: string | null;
  teacher: string | null;
}

export function weekdaysLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const names = ["", "Du", "Se", "Chor", "Pay", "Ju", "Sha", "Yak"];
  const parts = raw.split(",").map((x) => names[Number(x.trim())]).filter(Boolean);
  return parts.length ? parts.join(", ") : null;
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

export interface BranchSlotView { id: string; branchId: string; room: string; days: string; startTime: string; endTime: string; note: string | null; capacity: number | null }
export interface BranchColumn { branchId: string; name: string; color: string; slots: BranchSlotView[] }

export const BRANCH_COL_PREFIX = "br:";
export const branchColKey = (branchId: string) => BRANCH_COL_PREFIX + branchId;
export const isBranchCol = (key: string) => key.startsWith(BRANCH_COL_PREFIX);
export const branchIdOfCol = (key: string) => key.slice(BRANCH_COL_PREFIX.length).split(":")[0];
export const slotIdOfCol = (key: string): string | null => key.slice(BRANCH_COL_PREFIX.length).split(":")[1] ?? null;
export const slotDropKey = (branchId: string, slotId: string) => `${BRANCH_COL_PREFIX}${branchId}:${slotId}`;

export type BranchMode = "sales" | "head";
export interface BranchModeCfg {
  ids: Set<string>;
  mode: BranchMode;
  online: boolean;
  hideTest?: boolean;
}

export const ONLINE_COL = "online";

export const ARCHIVE_COL = "archive";
export const STUDENT_ARCHIVE_COL = "archive:student";
export const isArchiveCol = (key: string) => key === ARCHIVE_COL || key === STUDENT_ARCHIVE_COL;
export interface ArchivedStudent {
  id: string;
  fullName: string;
  phone: string | null;
  groupName: string | null;
}

export function isStudentArchive(lead: { stage: string; studentId?: string | null; archiveKind?: string | null }): boolean {
  if (lead.archiveKind === "STUDENT") return true;
  if (lead.archiveKind === "LEAD") return false;
  return lead.stage === "WON" || !!lead.studentId;
}

export function branchReplaces(mode: BranchMode): Set<string> {
  return mode === "sales" ? new Set(["offer"]) : new Set();
}

export function columnOfLead(
  lead: { stage: string; groupId: string | null; kanbanColumnId?: string | null; branchId?: string | null; studyFormat?: string | null; archivedAt?: string | null; studentId?: string | null },
  pinned: Set<string>,
  custom: Set<string> = EMPTY,
  branch: BranchModeCfg | null = null,
  hideTest = false,
): string {
  if (lead.archivedAt) return "lost";
  if (branch && lead.kanbanColumnId && isBranchCol(lead.kanbanColumnId) && branch.ids.has(branchIdOfCol(lead.kanbanColumnId))) {
    return lead.kanbanColumnId;
  }
  if (lead.kanbanColumnId && custom.has(lead.kanbanColumnId)) return customColKey(lead.kanbanColumnId);
  const base = columnOf(lead.stage);
  if (base === "won" && lead.groupId && pinned.has(lead.groupId)) return groupColKey(lead.groupId);
  if (branch) {
    const eff = branch.mode === "sales" && (base === "offer" || (base === "test" && branch.hideTest)) ? "new" : base;
    if (eff === "new" && lead.studyFormat === "ONLINE" && branch.online) return ONLINE_COL;
    return eff;
  }
  return hideTest && base === "test" ? "new" : base;
}


export const GROUP_COL_COLORS = [
  "#10b981", "#0ea5e9", "#6366f1", "#a855f7",
  "#ec4899", "#f97316", "#eab308", "#14b8a6",
];

export const GROUP_COL_ICONS = [
  "layers", "graduation", "users", "book",
  "trophy", "award", "calendar", "globe",
];

export interface ViewCol {
  key: string;
  title: string;
  sub: string | null;
  color: string;
  icon: string;
  defaultStage: string;
  groupId: string | null;
  customId: string | null;
  branch?: BranchColumn | null;
}

export function visibleColumns(opts: {
  locale: Locale;
  groupColumns: GroupColumn[];
  customColumns: CustomColumn[];
  branchColumns?: BranchColumn[] | null;
  branchMode?: BranchMode | null;
  showOnlineCol?: boolean;
  hiddenCols?: string[];
}): ViewCol[] {
  const { locale, groupColumns, customColumns, branchColumns = null, branchMode = null, showOnlineCol = true, hiddenCols = [] } = opts;
  const hidden = new Set(hiddenCols);

  const std = (key: string): ViewCol => {
    const c = COLUMNS.find((x) => x.key === key)!;
    return { key: c.key, title: tr(locale, c.label), sub: null, color: c.color, icon: c.icon, defaultStage: c.defaultStage, groupId: null, customId: null };
  };
  const custom = customColumns.map<ViewCol>((c) => ({
    key: customColKey(c.id), title: c.name, sub: null, color: c.color, icon: c.icon, defaultStage: "NEW", groupId: null, customId: c.id,
  }));
  const groups = groupColumns.map<ViewCol>((g) => ({
    key: groupColKey(g.groupId), title: g.name, sub: g.program, color: g.color, icon: g.icon, defaultStage: "WON", groupId: g.groupId, customId: null,
  }));

  if (branchColumns && branchMode) {
    const brs = branchColumns.map<ViewCol>((b) => ({
      key: branchColKey(b.branchId), title: b.name, sub: null, color: b.color, icon: "building", defaultStage: "OFFER", groupId: null, customId: null, branch: b,
    }));
    const online: ViewCol = {
      key: ONLINE_COL,
      title: tr(locale, { uz: "Onlayn", ru: "Онлайн", en: "Online", de: "Online" }),
      sub: tr(locale, { uz: "Onlayn o'qimoqchilar", ru: "Хотят учиться онлайн", en: "Want to study online", de: "Möchten online lernen" }),
      color: "#0ea5e9", icon: "video", defaultStage: "NEW", groupId: null, customId: null,
    };
    return [std("new"), std("work"), std("test"), ...(showOnlineCol ? [online] : []), ...(branchMode === "head" ? [std("offer")] : []), ...brs, ...custom, std("won"), ...groups, std("lost")]
      .filter((c) => !hidden.has(c.key));
  }
  return [std("new"), std("work"), std("test"), std("offer"), ...custom, std("won"), ...groups, std("lost")]
    .filter((c) => !hidden.has(c.key));
}
