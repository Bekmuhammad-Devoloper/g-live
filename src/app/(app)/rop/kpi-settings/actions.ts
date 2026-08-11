"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { setSetting } from "@/lib/settings";
import { writeAudit } from "@/lib/audit";
import { ROP_KPI_KEY, kpiSettingsSchema } from "./schema";

const MANAGE = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];

export type SaveState = { ok?: boolean; error?: string };

export async function saveRopKpi(raw: string): Promise<SaveState> {
  const s = await requireSession();
  if (!MANAGE.includes(s.role as never)) return { error: "forbidden" };

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { error: "invalid" }; }
  const res = kpiSettingsSchema.safeParse(parsed);
  if (!res.success) return { error: "invalid" };

  await setSetting(ROP_KPI_KEY, JSON.stringify(res.data));
  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "Setting",
    entityId: ROP_KPI_KEY,
    newValue: res.data,
    reason: "ROP KPI sozlamalari yangilandi",
  });

  revalidatePath("/rop/kpi-settings");
  return { ok: true };
}
