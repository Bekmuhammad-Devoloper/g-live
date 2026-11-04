export const LEAD_STATUSES = [
  { key: "NEW", label: "Yangi", accent: "bg-sky-400" },
  { key: "CONTACTED", label: "Bog'lanildi", accent: "bg-violet-400" },
  { key: "DEMO", label: "Demo ko'rsatildi", accent: "bg-amber-400" },
  { key: "OFFER", label: "Taklif berildi", accent: "bg-orange-400" },
  { key: "WON", label: "Sotildi", accent: "bg-emerald-400" },
  { key: "LOST", label: "Rad etdi", accent: "bg-slate-500" },
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

export function planPriceLabel(price: number | null): string {
  if (!price) return "Narxi kelishiladi";
  return `${price.toLocaleString("ru-RU").replace(/[,  ]/g, " ")} so'm`;
}
