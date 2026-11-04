"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isDevPanel } from "@/lib/instance";
import { devAudit } from "@/lib/devpanel/auth";
import { addLead, validateLead, withSales } from "@/lib/devpanel/sales";
import type { LeadInput } from "@/lib/devpanel/salesTypes";

const WINDOW_MS = 15 * 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function tooMany(ip: string): boolean {
  const now = Date.now();
  for (const [key, list] of hits) {
    if (list.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
  }
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) return true;
  list.push(now);
  hits.set(ip, list);
  return false;
}

const text = (v: unknown) => (typeof v === "string" ? v : "");

export async function submitSalesLead(code: string, raw: LeadInput & { website?: string }): Promise<{ ok: boolean; error?: string }> {
  if (!isDevPanel()) return { ok: false, error: "closed" };
  if (text(raw.website)) return { ok: true };

  const input: LeadInput = {
    centerName: text(raw.centerName), contactName: text(raw.contactName), phone: text(raw.phone),
    city: text(raw.city), students: text(raw.students), planId: text(raw.planId), message: text(raw.message),
  };
  const invalid = validateLead(input);
  if (invalid) return { ok: false, error: invalid };

  const ip = (await headers()).get("x-real-ip") || "unknown";
  if (tooMany(ip)) return { ok: false, error: "too_many" };

  const result = await withSales((d) => {
    const link = d.links.find((l) => l.code === code && l.active);
    if (!link) return "closed" as const;
    return addLead(d, input, link);
  });
  if (result === "closed" || result === "full") return { ok: false, error: result };

  await devAudit("sales_lead", { lead: result.id, center: result.centerName, link: result.linkName, submissions: result.submissions });
  revalidatePath("/dev/sales");
  return { ok: true };
}
