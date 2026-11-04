"use server";

import { revalidatePath } from "next/cache";
import { devAudit, requireDev } from "@/lib/devpanel/auth";
import { addLead, leadFields, newCode, validateLead, withSales } from "@/lib/devpanel/sales";
import { isLeadStatus, type LeadInput, type SalesPlan } from "@/lib/devpanel/salesTypes";

export type ActionResult = { ok: boolean; error?: string };

const LEAD_ERRORS: Record<string, string> = {
  center: "Markaz nomini kiriting",
  contact: "Bog'lanish uchun ismni kiriting",
  phone: "Telefon raqami noto'g'ri",
  full: "Lidlar soni chegaraga yetdi",
};

const refresh = () => {
  revalidatePath("/dev/sales");
  revalidatePath("/dev/plans");
};

export async function createLeadAction(input: LeadInput): Promise<ActionResult> {
  const dev = await requireDev();
  const invalid = validateLead(input);
  if (invalid) return { ok: false, error: LEAD_ERRORS[invalid] };
  const r = await withSales((d) => addLead(d, input, null));
  if (r === "full") return { ok: false, error: LEAD_ERRORS.full };
  await devAudit("sales_lead", { by: dev.email, lead: r.id, center: r.centerName, manual: true });
  refresh();
  return { ok: true };
}

export async function updateLeadAction(id: string, input: LeadInput & { note: string }): Promise<ActionResult> {
  const dev = await requireDev();
  const invalid = validateLead(input);
  if (invalid) return { ok: false, error: LEAD_ERRORS[invalid] };
  const found = await withSales((d) => {
    const lead = d.leads.find((l) => l.id === id);
    if (!lead) return false;
    Object.assign(lead, leadFields(d, input), { note: input.note.trim().slice(0, 2000), updatedAt: new Date().toISOString() });
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

export async function createLinkAction(rawName: string): Promise<ActionResult> {
  const dev = await requireDev();
  const name = rawName.trim().slice(0, 60);
  if (name.length < 2) return { ok: false, error: "Havola nomini kiriting" };
  const code = newCode();
  await withSales((d) => {
    d.links.push({ code, name, createdAt: new Date().toISOString(), active: true });
  });
  await devAudit("sales_link_create", { by: dev.email, code, name });
  refresh();
  return { ok: true };
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
  revalidatePath("/dev/obuna", "layout");
  return { ok: true };
}
