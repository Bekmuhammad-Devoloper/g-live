import "server-only";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { parseUzPhone } from "@/lib/phone";
import { APP_DIR } from "./registry";
import { withSales } from "./sales";
import { businessLabel, linkKind, type SalesLead } from "./salesTypes";

export const CENTER_LEAD_SOURCE = "Dev panel";

const store = globalThis as unknown as { __glMainDb?: PrismaClient };

function mainDb(): PrismaClient {
  return (store.__glMainDb ??= new PrismaClient({
    datasources: { db: { url: `file:${path.join(APP_DIR, "prisma", "dev.db")}` } },
  }));
}

export type ForwardResult = { ok: true; centerLeadId: string } | { ok: false; error: string };

export async function forwardLeadToCenter(id: string): Promise<ForwardResult> {
  const lead = await withSales((d) => d.leads.find((l) => l.id === id) ?? null);
  if (!lead) return { ok: false, error: "Lid topilmadi" };
  if (lead.centerLeadId) {
    await markForwarded(id, lead.centerLeadId);
    return { ok: true, centerLeadId: lead.centerLeadId };
  }

  let centerLeadId: string;
  try {
    centerLeadId = await createCenterLead(lead);
  } catch {
    return { ok: false, error: "O'quv markazi bazasiga yozib bo'lmadi. Qayta urinib ko'ring" };
  }
  await markForwarded(id, centerLeadId);
  return { ok: true, centerLeadId };
}

async function markForwarded(id: string, centerLeadId: string): Promise<void> {
  await withSales((d) => {
    const l = d.leads.find((x) => x.id === id);
    if (!l) return;
    l.status = "CENTER";
    l.centerLeadId = centerLeadId;
    l.updatedAt = new Date().toISOString();
  });
}

async function createCenterLead(lead: SalesLead): Promise<string> {
  const db = mainDb();
  const phone = parseUzPhone(lead.phone) ?? lead.phone;
  const dups = await db.lead.count({ where: { phone } });
  const business = linkKind(lead) === "automation" ? businessLabel(lead.businessType) : "";
  const note = [
    lead.centerName && lead.centerName !== lead.contactName ? `Arizada yozilgan nom: ${lead.centerName}` : "",
    business ? `Biznes turi: ${business}` : "",
    lead.city ? `Shahar: ${lead.city}` : "",
    lead.students != null ? `Arizadagi son: ${lead.students}` : "",
    lead.message ? `Mijoz izohi: ${lead.message}` : "",
    lead.note ? `Dev panel eslatmasi: ${lead.note}` : "",
  ].filter(Boolean).join("\n");
  const created = await db.lead.create({
    data: {
      fullName: (lead.contactName || lead.centerName).slice(0, 120),
      phone,
      source: CENTER_LEAD_SOURCE,
      utmSource: CENTER_LEAD_SOURCE,
      stage: "NEW",
      note: note || null,
      activities: {
        create: {
          type: "note",
          result: `Dev paneldan yo'naltirildi${lead.linkName ? ` (havola: ${lead.linkName})` : ""}`
            + (dups > 0 ? ` (takroriy: bu raqam bilan avval ${dups} ta lid bor)` : ""),
        },
      },
    },
    select: { id: true },
  });
  return created.id;
}
