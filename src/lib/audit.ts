import "server-only";
import { prisma } from "./db";

// Muhim amallarni audit jurnaliga yozish (TZ 2.2, 6-NFR "Audit").
// Bu yozuvlar interfeys orqali o'chirilmaydi/tahrirlanmaydi.
export async function writeAudit(params: {
  actorId?: string | null;
  action: string; // CREATE | UPDATE | CANCEL | LOGIN | ...
  entityType: string; // "Payment", "Lead", ...
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  ip?: string | null;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      oldValue: params.oldValue != null ? JSON.stringify(params.oldValue) : null,
      newValue: params.newValue != null ? JSON.stringify(params.newValue) : null,
      reason: params.reason ?? null,
      ip: params.ip ?? null,
    },
  });
}
