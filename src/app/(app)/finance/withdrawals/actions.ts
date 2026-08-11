"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canWrite, MODULES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { formatMoney } from "@/lib/constants";

const PURPOSE = "Yechib olish";

const schema = z.object({
  studentId: z.string().min(1),
  amount: z.coerce.number().int().positive(),
  note: z.string().optional(),
});

export type WdState = { ok?: boolean; error?: string };

// Yechib olish (pul qaytarish) — REFUNDED yozuv sifatida saqlanadi, audit bilan.
export async function createWithdrawal(_prev: WdState, formData: FormData): Promise<WdState> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.PAYMENTS)) return { error: "forbidden" };

  const parsed = schema.safeParse({
    studentId: formData.get("studentId"),
    amount: formData.get("amount"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  const wd = await prisma.payment.create({
    data: {
      studentId: parsed.data.studentId,
      amount: parsed.data.amount,
      method: "CASH",
      purpose: PURPOSE,
      status: "REFUNDED",
      isManual: true,
      note: parsed.data.note,
      docNumber: `WD-${randomUUID().slice(0, 8).toUpperCase()}`,
      authorId: s.userId,
    },
  });

  await writeAudit({
    actorId: s.userId,
    action: "CREATE",
    entityType: "Payment",
    entityId: wd.id,
    newValue: { amount: wd.amount, purpose: PURPOSE, status: "REFUNDED" },
    reason: "Yechib olish (pul qaytarish)",
  });

  // O'quvchiga bildirishnoma
  const student = await prisma.student.findUnique({
    where: { id: parsed.data.studentId },
    include: { parents: { include: { parent: true } } },
  });
  if (student) {
    const title = "Yechib olish amalga oshirildi";
    const body = `${formatMoney(wd.amount)} hisobingizdan qaytarildi.`;
    if (student.userId) await notify({ userId: student.userId, title, body, event: "payment_refund" });
    for (const link of student.parents) {
      if (link.parent.userId) await notify({ userId: link.parent.userId, title, body, event: "payment_refund" });
    }
  }

  revalidatePath("/finance/withdrawals");
  return { ok: true };
}

// Bekor qilish — o'chirish emas, status CANCELLED (audit, TZ FR-PAY-04)
export async function cancelWithdrawal(id: string, reason: string): Promise<void> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.PAYMENTS)) return;
  if (!reason || reason.trim().length < 3) return;

  const before = await prisma.payment.findUnique({ where: { id } });
  if (!before || before.status === "CANCELLED") return;

  await prisma.payment.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
  });

  await writeAudit({
    actorId: s.userId,
    action: "CANCEL",
    entityType: "Payment",
    entityId: id,
    oldValue: { status: before.status },
    newValue: { status: "CANCELLED" },
    reason,
  });

  revalidatePath("/finance/withdrawals");
}
