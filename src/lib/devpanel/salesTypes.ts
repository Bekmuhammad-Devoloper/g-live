export const DEFAULT_LINK_CODE = "k7m2xq9p";

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
}

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
}

export interface LeadInput {
  centerName: string;
  contactName: string;
  phone: string;
  city: string;
  students: string;
  planId: string;
  message: string;
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
