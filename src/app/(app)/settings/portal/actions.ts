"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { writeAudit } from "@/lib/audit";
import { PORTAL_FEATURES, setPortalFlag, type PortalFeature } from "@/lib/portalFeatures";

// Portal bo'limlarini yoqish/o'chirish — menejer va rahbariyat
const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.MANAGER];

export type PortalState = { ok?: boolean; error?: string };

export async function savePortalFlags(_prev: PortalState, formData: FormData): Promise<PortalState> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };

  const changed: Record<string, boolean> = {};
  for (const f of PORTAL_FEATURES) {
    const on = formData.get(f.key) === "on";
    await setPortalFlag(f.key as PortalFeature, on);
    changed[f.key] = on;
  }

  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "PortalFeatures",
    newValue: changed,
    reason: "O'quvchi portali bo'limlari sozlandi",
  });

  revalidatePath("/settings/portal");
  revalidatePath("/student", "layout");
  return { ok: true };
}
