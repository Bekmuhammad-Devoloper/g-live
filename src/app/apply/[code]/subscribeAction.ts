"use server";

import { headers } from "next/headers";
import { isDevPanel } from "@/lib/instance";
import { devAudit } from "@/lib/devpanel/auth";
import { addLead, findPromo, readSales, validateLead, withSales } from "@/lib/devpanel/sales";
import { isBusinessType, linkKind, type LeadInput } from "@/lib/devpanel/salesTypes";

const WINDOW_MS = 15 * 60_000;
const MAX_PER_WINDOW = 5;
const MAX_PROMO_CHECKS = 20;
const hits = new Map<string, number[]>();
const promoHits = new Map<string, number[]>();

function tooMany(store: Map<string, number[]>, ip: string, max: number): boolean {
  const now = Date.now();
  for (const [key, list] of store) {
    if (list.every((t) => now - t >= WINDOW_MS)) store.delete(key);
  }
  const list = (store.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= max) return true;
  list.push(now);
  store.set(ip, list);
  return false;
}

const text = (v: unknown) => (typeof v === "string" ? v : "");

export type PromoCheck = { ok: true; code: string; discount: number; months: number } | { ok: false; error: string };

export async function checkSubscribePromo(code: string, raw: string): Promise<PromoCheck> {
  if (process.env.GL_INSTANCE || isDevPanel()) return { ok: false, error: "closed" };
  const ip = (await headers()).get("x-real-ip");
  if (ip && tooMany(promoHits, ip, MAX_PROMO_CHECKS)) return { ok: false, error: "too_many" };
  const d = await readSales();
  if (!d.links.some((l) => l.code === code && l.active && linkKind(l) === "subscribe")) return { ok: false, error: "closed" };
  const promo = findPromo(d, text(raw));
  if (!promo) return { ok: false, error: "promo" };
  return { ok: true, code: promo.code, discount: promo.discount, months: promo.months };
}

export async function submitSubscribeLead(code: string, raw: LeadInput & { website?: string; promo?: string }): Promise<{ ok: boolean; error?: string }> {
  if (process.env.GL_INSTANCE || isDevPanel()) return { ok: false, error: "closed" };
  if (text(raw.website)) return { ok: true };

  const input: LeadInput = {
    centerName: text(raw.centerName), contactName: text(raw.contactName), phone: text(raw.phone),
    city: text(raw.city), students: text(raw.students), planId: text(raw.planId), message: text(raw.message),
  };
  const invalid = validateLead(input);
  if (invalid) return { ok: false, error: invalid };

  const ip = (await headers()).get("x-real-ip");
  if (ip && tooMany(hits, ip, MAX_PER_WINDOW)) return { ok: false, error: "too_many" };

  const promoText = text(raw.promo).trim();
  const result = await withSales((d) => {
    const link = d.links.find((l) => l.code === code && l.active && linkKind(l) === "subscribe");
    if (!link) return "closed" as const;
    const promo = promoText ? findPromo(d, promoText) : null;
    if (promoText && !promo) return "promo" as const;
    return addLead(d, input, link, promo);
  });
  if (result === "closed" || result === "full" || result === "promo") return { ok: false, error: result };

  await devAudit("sales_lead", { lead: result.id, center: result.centerName, link: result.linkName, submissions: result.submissions, promo: result.promoCode ?? null });
  return { ok: true };
}

export async function submitAutomationLead(code: string, raw: LeadInput & { website?: string }): Promise<{ ok: boolean; error?: string }> {
  if (process.env.GL_INSTANCE || isDevPanel()) return { ok: false, error: "closed" };
  if (text(raw.website)) return { ok: true };

  const input: LeadInput = {
    centerName: text(raw.centerName), contactName: text(raw.contactName), phone: text(raw.phone),
    city: text(raw.city), students: text(raw.students), planId: "", message: text(raw.message),
    businessType: text(raw.businessType),
  };
  if (!isBusinessType(input.businessType)) return { ok: false, error: "business" };
  const invalid = validateLead(input);
  if (invalid) return { ok: false, error: invalid };

  const ip = (await headers()).get("x-real-ip");
  if (ip && tooMany(hits, ip, MAX_PER_WINDOW)) return { ok: false, error: "too_many" };

  const result = await withSales((d) => {
    const link = d.links.find((l) => l.code === code && l.active && linkKind(l) === "automation");
    if (!link) return "closed" as const;
    return addLead(d, input, link);
  });
  if (result === "closed" || result === "full") return { ok: false, error: result };

  await devAudit("sales_lead", { lead: result.id, center: result.centerName, link: result.linkName, submissions: result.submissions, business: result.businessType ?? null });
  return { ok: true };
}
