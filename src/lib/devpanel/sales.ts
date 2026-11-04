import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { CENTERS_ROOT } from "./registry";
import {
  DEFAULT_LINK_CODE, normalizePhone, parseStudents, isOpenStatus,
  type LeadInput, type SalesLead, type SalesLink, type SalesPlan,
} from "./salesTypes";

const FILE = path.join(CENTERS_ROOT, "sales.json");
const LOCK = `${FILE}.lock`;
const LOCK_STALE_MS = 30_000;
const LOCK_WAIT_MS = 10_000;
const MAX_LEADS = 5000;

export interface SalesData {
  plans: SalesPlan[];
  links: SalesLink[];
  leads: SalesLead[];
}

const defaults = (): SalesData => ({
  plans: [
    {
      id: "start", name: "Start", price: 400_000, students: 100, branches: 1, popular: false, visible: true,
      features: ["O'quvchilar va guruhlar", "Davomat jurnali", "To'lov va qarzdorlik", "Lidlar CRM"],
    },
    {
      id: "standart", name: "Standart", price: 940_000, students: 300, branches: 3, popular: true, visible: true,
      features: ["Start tarifidagi hamma imkoniyat", "Moliya va oylik hisobi", "Hisobotlar"],
    },
    {
      id: "pro", name: "Pro", price: 1_460_000, students: 1000, branches: 5, popular: false, visible: true,
      features: ["Standart tarifidagi hamma imkoniyat", "Ko'proq o'quvchi va filial"],
    },
    {
      id: "premium", name: "Premium", price: 2_900_000, students: null, branches: null, popular: false, visible: true,
      features: ["Pro tarifidagi hamma imkoniyat", "AI yordamchi", "Telefoniya (alohida ulanadi)"],
    },
  ],
  links: [{ code: DEFAULT_LINK_CODE, name: "Umumiy havola", createdAt: new Date(0).toISOString(), active: true }],
  leads: [],
});

export async function readSales(): Promise<SalesData> {
  let raw: string;
  try {
    raw = await fs.readFile(FILE, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return defaults();
    throw e;
  }
  const d = JSON.parse(raw) as Partial<SalesData>;
  const base = defaults();
  return { plans: d.plans ?? base.plans, links: d.links ?? base.links, leads: d.leads ?? [] };
}

async function writeSales(d: SalesData): Promise<void> {
  await fs.mkdir(CENTERS_ROOT, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(d, null, 2), { mode: 0o600 });
  await fs.rename(tmp, FILE);
}

async function acquireLock(): Promise<void> {
  await fs.mkdir(CENTERS_ROOT, { recursive: true });
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      await fs.mkdir(LOCK);
      return;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    const held = await fs.stat(LOCK).catch(() => null);
    if (held && Date.now() - held.mtimeMs > LOCK_STALE_MS) {
      await fs.rmdir(LOCK).catch(() => undefined);
      continue;
    }
    if (Date.now() > deadline) throw new Error("sales.json band");
    await new Promise((r) => setTimeout(r, 50));
  }
}

const store = globalThis as unknown as { __glSalesChain?: Promise<unknown> };

export function withSales<T>(fn: (d: SalesData) => T | Promise<T>): Promise<T> {
  const run = (store.__glSalesChain ?? Promise.resolve()).then(async () => {
    await acquireLock();
    try {
      const d = await readSales();
      const r = await fn(d);
      await writeSales(d);
      return r;
    } finally {
      await fs.rmdir(LOCK).catch(() => undefined);
    }
  });
  store.__glSalesChain = run.catch(() => undefined);
  return run;
}

export const newCode = () => randomBytes(4).toString("hex");

export type LeadError = "center" | "contact" | "phone" | "full";

export function validateLead(input: LeadInput): LeadError | null {
  if (input.centerName.trim().length < 2) return "center";
  if (input.contactName.trim().length < 2) return "contact";
  if (!normalizePhone(input.phone)) return "phone";
  return null;
}

export function leadFields(d: SalesData, input: LeadInput) {
  const plan = d.plans.find((p) => p.id === input.planId) ?? null;
  return {
    centerName: input.centerName.trim().slice(0, 120),
    contactName: input.contactName.trim().slice(0, 80),
    phone: normalizePhone(input.phone) ?? "",
    city: input.city.trim().slice(0, 80),
    students: parseStudents(input.students),
    planId: plan?.id ?? null,
    planName: plan?.name ?? null,
    message: input.message.trim().slice(0, 1000),
  };
}

export function addLead(d: SalesData, input: LeadInput, link: SalesLink | null): SalesLead | "full" {
  const fields = leadFields(d, input);
  const now = new Date().toISOString();
  const open = d.leads.find((l) => l.phone === fields.phone && isOpenStatus(l.status));
  if (open) {
    Object.assign(open, {
      centerName: fields.centerName,
      contactName: fields.contactName,
      city: fields.city || open.city,
      students: fields.students ?? open.students,
      planId: fields.planId ?? open.planId,
      planName: fields.planName ?? open.planName,
      message: [open.message, fields.message].filter(Boolean).join("\n").slice(0, 2000),
      submissions: open.submissions + 1,
      updatedAt: now,
    });
    return open;
  }
  if (d.leads.length >= MAX_LEADS) return "full";
  const lead: SalesLead = {
    id: randomBytes(8).toString("hex"), ...fields, status: "NEW", note: "",
    linkCode: link?.code ?? null, linkName: link?.name ?? null, centerSlug: null,
    submissions: 1, createdAt: now, updatedAt: now,
  };
  d.leads.unshift(lead);
  return lead;
}

export async function linkLeadToCenter(leadId: string, slug: string): Promise<void> {
  await withSales((d) => {
    const lead = d.leads.find((l) => l.id === leadId);
    if (!lead) return;
    lead.centerSlug = slug;
    lead.status = "WON";
    lead.updatedAt = new Date().toISOString();
  });
}
