"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canWrite, MODULES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

export type CallbackState = { ok?: boolean; error?: string };

/** O'tkazib yuborilgan qo'ng'iroqni "bog'lanildi" deb belgilash. */
export async function markCalledBack(callId: string): Promise<CallbackState> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CRM)) return { error: "forbidden" };
  if (!callId) return { error: "invalid" };

  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: { id: true, callbackStatus: true },
  });
  if (!call) return { error: "not_found" };

  await prisma.call.update({
    where: { id: callId },
    data: { callbackStatus: "CALLED_BACK", callbackAt: new Date() },
  });

  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "Call",
    entityId: callId,
    oldValue: { callbackStatus: call.callbackStatus },
    newValue: { callbackStatus: "CALLED_BACK" },
  });

  revalidatePath("/reports/calls");
  return { ok: true };
}
