"use server";

import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { PLATFORMS, platform } from "@/app/(app)/links/platforms";
import { devAudit, requireDev } from "@/lib/devpanel/auth";
import { addLead, leadFields, newCode, validateLead, withSales } from "@/lib/devpanel/sales";
import { BASE_DOMAIN } from "@/lib/devpanel/registry";
import { AUTOMATION_LINK_CODE, DEFAULT_LINK_CODE, isBusinessType, isLeadStatus, kindLabel, linkKind, normalizePromo, type LeadInput, type LinkKind, type SalesPlan } from "@/lib/devpanel/salesTypes";

export type ActionResult = { ok: boolean; error?: string };
export type CreatedSalesLink = { code: string; name: string };

const MAX_LINKS = 500;

const LEAD_ERRORS: Record<string, string> = {
  center: "Markaz nomini kiriting",
  contact: "Bog'lanish uchun ismni kiriting",
  phone: "Telefon raqami noto'g'ri",
  full: "Lidlar soni chegaraga yetdi",
};

const refresh = () => {
  revalidatePath("/dev/sales");
  revalidatePath("/dev/plans");
  revalidatePath("/dev/links");
};

export async function createLeadAction(input: LeadInput & { status?: string }): Promise<ActionResult> {
  const dev = await requireDev();
  const invalid = validateLead(input);
  if (invalid) return { ok: false, error: LEAD_ERRORS[invalid] };
  const r = await withSales((d) => {
    const lead = addLead(d, input, null);
    if (lead !== "full" && input.status && isLeadStatus(input.status)) lead.status = input.status;
    return lead;
  });
  if (r === "full") return { ok: false, error: LEAD_ERRORS.full };
  await devAudit("sales_lead", { by: dev.email, lead: r.id, center: r.centerName, manual: true });
  refresh();
  return { ok: true };
}

export async function updateLeadAction(id: string, input: LeadInput & { note: string; status: string }): Promise<ActionResult> {
  const dev = await requireDev();
  const invalid = validateLead(input);
  if (invalid) return { ok: false, error: LEAD_ERRORS[invalid] };
  if (!isLeadStatus(input.status)) return { ok: false, error: "Holat noto'g'ri" };
  const status = input.status;
  const found = await withSales((d) => {
    const lead = d.leads.find((l) => l.id === id);
    if (!lead) return false;
    Object.assign(lead, leadFields(d, input), { status, note: input.note.trim().slice(0, 2000), updatedAt: new Date().toISOString() });
    if (linkKind(lead) === "automation") lead.businessType = isBusinessType(input.businessType) ? input.businessType : null;
    return true;
  });
  if (!found) return { ok: false, error: "Lid topilmadi" };
  await devAudit("sales_lead_update", { by: dev.email, lead: id });
  refresh();
  return { ok: true };
}

export async function setLeadStatusAction(id: string, status: string): Promise<ActionResult> {
  const dev = await requireDev();
  if (!isLeadStatus(status)) return { ok: false, error: "Holat noto'g'ri" };
  const found = await withSales((d) => {
    const lead = d.leads.find((l) => l.id === id);
    if (!lead) return false;
    lead.status = status;
    lead.updatedAt = new Date().toISOString();
    return true;
  });
  if (!found) return { ok: false, error: "Lid topilmadi" };
  await devAudit("sales_lead_status", { by: dev.email, lead: id, status });
  refresh();
  return { ok: true };
}

export async function deleteLeadAction(id: string): Promise<ActionResult> {
  const dev = await requireDev();
  const name = await withSales((d) => {
    const i = d.leads.findIndex((l) => l.id === id);
    if (i < 0) return null;
    return d.leads.splice(i, 1)[0].centerName;
  });
  if (name === null) return { ok: false, error: "Lid topilmadi" };
  await devAudit("sales_lead_delete", { by: dev.email, lead: id, center: name });
  refresh();
  return { ok: true };
}

export async function createLinksAction(input: { name: string; kind: string; businessType: string; platforms: string[] }): Promise<ActionResult & { links?: CreatedSalesLink[] }> {
  const dev = await requireDev();
  const kind: LinkKind = input.kind === "automation" ? "automation" : "subscribe";
  const keys = [...new Set(Array.isArray(input.platforms) ? input.platforms : [])].filter((k) => PLATFORMS.some((p) => p.key === k));
  if (keys.length === 0) return { ok: false, error: "Kamida bitta platforma tanlang" };
  const title = String(input.name ?? "").trim().slice(0, 60) || kindLabel(kind);
  const businessType = kind === "automation" && isBusinessType(input.businessType) ? input.businessType : null;
  const now = new Date().toISOString();
  const created = keys.map((key) => ({
    code: newCode(), name: `${title} · ${platform(key).label}`, createdAt: now, active: true, kind, platform: key, businessType, views: 0, lastViewedAt: null,
  }));
  const ok = await withSales((d) => {
    if (d.links.length + created.length > MAX_LINKS) return false;
    d.links.push(...created);
    return true;
  });
  if (!ok) return { ok: false, error: "Havolalar soni chegaraga yetdi" };
  await devAudit("sales_link_create", { by: dev.email, kind, codes: created.map((l) => l.code), name: title });
  refresh();
  return { ok: true, links: created.map((l) => ({ code: l.code, name: l.name })) };
}

export async function deleteLinkAction(code: string): Promise<ActionResult> {
  const dev = await requireDev();
  if (code === DEFAULT_LINK_CODE || code === AUTOMATION_LINK_CODE) return { ok: false, error: "Asosiy havola o'chirilmaydi" };
  const result = await withSales((d) => {
    const i = d.links.findIndex((l) => l.code === code);
    if (i < 0) return "missing" as const;
    if (d.leads.some((l) => l.linkCode === code)) return "used" as const;
    d.links.splice(i, 1);
    return "ok" as const;
  });
  if (result === "missing") return { ok: false, error: "Havola topilmadi" };
  if (result === "used") return { ok: false, error: "Arizasi bor havola o'chirilmaydi, uni o'chirib qo'ying" };
  await devAudit("sales_link_delete", { by: dev.email, code });
  refresh();
  return { ok: true };
}

export async function salesLinkQrAction(code: string): Promise<{ url: string; qr: string } | { error: string }> {
  await requireDev();
  const url = `https://${BASE_DOMAIN}/apply/${encodeURIComponent(code)}`;
  try {
    return { url, qr: await QRCode.toDataURL(url, { width: 512, margin: 1 }) };
  } catch {
    return { error: "QR yaratib bo'lmadi" };
  }
}

export async function setLinkActiveAction(code: string, active: boolean): Promise<ActionResult> {
  const dev = await requireDev();
  const found = await withSales((d) => {
    const link = d.links.find((l) => l.code === code);
    if (!link) return false;
    link.active = active;
    return true;
  });
  if (!found) return { ok: false, error: "Havola topilmadi" };
  await devAudit("sales_link_toggle", { by: dev.email, code, active });
  refresh();
  return { ok: true };
}

const limit = (v: unknown, max: number): number | null => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : null;
};

export async function savePlansAction(plans: SalesPlan[]): Promise<ActionResult> {
  const dev = await requireDev();
  if (!Array.isArray(plans) || plans.length > 12) return { ok: false, error: "Tariflar soni noto'g'ri" };
  const clean: SalesPlan[] = plans.map((p) => ({
    id: String(p.id).slice(0, 40) || newCode(),
    name: String(p.name ?? "").trim().slice(0, 40),
    price: limit(p.price, 10_000_000_000),
    students: limit(p.students, 1_000_000),
    branches: limit(p.branches, 1_000),
    features: (Array.isArray(p.features) ? p.features : []).map((x) => String(x).trim().slice(0, 80)).filter(Boolean).slice(0, 12),
    popular: !!p.popular,
    visible: !!p.visible,
  }));
  if (clean.some((p) => p.name.length < 2)) return { ok: false, error: "Har bir tarifga nom bering" };
  if (new Set(clean.map((p) => p.name.toLowerCase())).size !== clean.length) return { ok: false, error: "Tarif nomlari takrorlanmasin" };
  await withSales((d) => {
    d.plans = clean;
  });
  await devAudit("sales_plans_save", { by: dev.email, plans: clean.map((p) => ({ name: p.name, price: p.price })) });
  refresh();
  return { ok: true };
}

export async function createPromoAction(input: { code: string; discount: number; months: number }): Promise<ActionResult> {
  const dev = await requireDev();
  const code = normalizePromo(String(input.code ?? ""));
  const discount = limit(input.discount, 1_000_000_000);
  const months = limit(input.months, 36);
  if (code.length < 3) return { ok: false, error: "Promokod kamida 3 belgi bo'lsin" };
  if (!discount) return { ok: false, error: "Chegirma summasini kiriting" };
  if (!months) return { ok: false, error: "Necha oyga ekanini kiriting" };
  const created = await withSales((d) => {
    if (d.promos.some((p) => p.code === code)) return false;
    d.promos.push({ code, discount, months, active: true, createdAt: new Date().toISOString() });
    return true;
  });
  if (!created) return { ok: false, error: "Bunday promokod bor" };
  await devAudit("sales_promo_create", { by: dev.email, code, discount, months });
  refresh();
  return { ok: true };
}

export async function setPromoActiveAction(code: string, active: boolean): Promise<ActionResult> {
  const dev = await requireDev();
  const found = await withSales((d) => {
    const promo = d.promos.find((p) => p.code === code);
    if (!promo) return false;
    promo.active = active;
    return true;
  });
  if (!found) return { ok: false, error: "Promokod topilmadi" };
  await devAudit("sales_promo_toggle", { by: dev.email, code, active });
  refresh();
  return { ok: true };
}

export async function deletePromoAction(code: string): Promise<ActionResult> {
  const dev = await requireDev();
  const found = await withSales((d) => {
    const i = d.promos.findIndex((p) => p.code === code);
    if (i < 0) return false;
    d.promos.splice(i, 1);
    return true;
  });
  if (!found) return { ok: false, error: "Promokod topilmadi" };
  await devAudit("sales_promo_delete", { by: dev.email, code });
  refresh();
  return { ok: true };
}
