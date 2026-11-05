export const DEFAULT_LINK_CODE = "k7m2xq9p";
export const AUTOMATION_LINK_CODE = "a9t4mz7k";

export const LINK_KINDS = [
  { key: "subscribe", label: "Obuna" },
  { key: "automation", label: "Avtomatlashtirish" },
] as const;

export type LinkKind = (typeof LINK_KINDS)[number]["key"];

export const kindLabel = (kind: LinkKind) => LINK_KINDS.find((k) => k.key === kind)?.label ?? kind;

export const BUSINESS_TYPES = [
  { key: "agency", label: "Xususiy bandlik agentligi", icon: "users" },
  { key: "pharmacy", label: "Apteka", icon: "plus" },
  { key: "center", label: "O'quv markazi", icon: "book" },
  { key: "school", label: "Maktab", icon: "building" },
  { key: "kindergarten", label: "Bog'cha", icon: "users" },
  { key: "clinic", label: "Klinika", icon: "plus" },
  { key: "shop", label: "Savdo do'koni", icon: "wallet" },
  { key: "other", label: "Boshqa", icon: "grid" },
] as const;

export const isBusinessType = (v: unknown): v is string => BUSINESS_TYPES.some((b) => b.key === v);
export const businessLabel = (key: string | null | undefined) => BUSINESS_TYPES.find((b) => b.key === key)?.label ?? "";

export const LEAD_STATUSES = [
  { key: "NEW", label: "Yangi", color: "#3b82f6", icon: "download" },
  { key: "CONTACTED", label: "Bog'lanildi", color: "#f59e0b", icon: "phone" },
  { key: "DEMO", label: "Demo ko'rsatildi", color: "#0ea5e9", icon: "video" },
  { key: "OFFER", label: "Taklif berildi", color: "#8b5cf6", icon: "wallet" },
  { key: "WON", label: "Sotildi", color: "#10b981", icon: "check" },
  { key: "LOST", label: "Rad etdi", color: "#ef4444", icon: "close" },
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number]["key"];

export const isLeadStatus = (v: string): v is LeadStatus => LEAD_STATUSES.some((s) => s.key === v);
export const isOpenStatus = (s: LeadStatus) => s !== "WON" && s !== "LOST";

export interface SalesPlan {
  id: string;
  name: string;
  price: number | null;
  students: number | null;
  branches: number | null;
  features: string[];
  popular: boolean;
  visible: boolean;
}

export interface SalesLink {
  code: string;
  name: string;
  createdAt: string;
  active: boolean;
  kind?: LinkKind;
  platform?: string | null;
  businessType?: string | null;
  views?: number;
  lastViewedAt?: string | null;
}

export const linkKind = (l: { kind?: LinkKind }): LinkKind => l.kind ?? "subscribe";

export interface SalesPromo {
  code: string;
  discount: number;
  months: number;
  active: boolean;
  createdAt: string;
}

export interface SalesLead {
  id: string;
  centerName: string;
  contactName: string;
  phone: string;
  city: string;
  students: number | null;
  planId: string | null;
  planName: string | null;
  message: string;
  status: LeadStatus;
  note: string;
  linkCode: string | null;
  linkName: string | null;
  centerSlug: string | null;
  submissions: number;
  createdAt: string;
  updatedAt: string;
  promoCode?: string | null;
  promoDiscount?: number;
  promoMonths?: number;
  kind?: LinkKind;
  businessType?: string | null;
}

export interface LeadInput {
  centerName: string;
  contactName: string;
  phone: string;
  city: string;
  students: string;
  planId: string;
  message: string;
  kind?: LinkKind;
  businessType?: string;
}

export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length === 9) return `+998${d}`;
  if (d.length < 9 || d.length > 15) return null;
  return `+${d}`;
}

export function formatPhone(phone: string): string {
  const m = phone.match(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}

export function parseStudents(raw: string): number | null {
  const d = raw.replace(/\D/g, "").slice(0, 6);
  return d ? Number(d) : null;
}

export function sumLabel(n: number): string {
  return `${n.toLocaleString("ru-RU").replace(/[,  ]/g, " ")} so'm`;
}

export function planPriceLabel(price: number | null): string {
  if (!price) return "Narxi kelishiladi";
  return sumLabel(price);
}

export function normalizePromo(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24);
}

export function promoPeriod(months: number): string {
  return months === 1 ? "Birinchi oy" : `Dastlabki ${months} oy`;
}
