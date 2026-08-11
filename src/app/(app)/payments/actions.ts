"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canWrite, MODULES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { formatMoney, PAYMENT_METHODS } from "@/lib/constants";

const schema = z.object({
  studentId: z.string().min(1),
  amount: z.coerce.number().int().positive(),
  method: z.enum(PAYMENT_METHODS),
  purpose: z.string().min(1),
  docNumber: z.string().min(1), // TZ FR-PAY-03 — hujjat/chek raqami majburiy
  note: z.string().optional(),
});

export type PayState = { ok?: boolean; error?: string };

// Qo'lda to'lov kiritish — faqat MANAGER va DEPUTY_DIRECTOR (TZ FR-PAY-02)
export async function createManualPayment(_prev: PayState, formData: FormData): Promise<PayState> {
  const s = await requireSession();

  if (!canWrite(s.role, MODULES.PAYMENTS)) {
    return { error: "forbidden" };
  }

  const parsed = schema.safeParse({
    studentId: formData.get("studentId"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    purpose: formData.get("purpose"),
    docNumber: formData.get("docNumber"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  const payment = await prisma.payment.create({
    data: {
      ...parsed.data,
      status: "PAID",
      isManual: true,
      authorId: s.userId,
    },
  });

  // TZ FR-PAY-04 — har bir qo'lda amal audit bilan saqlanadi
  await writeAudit({
    actorId: s.userId,
    action: "CREATE",
    entityType: "Payment",
    entityId: payment.id,
    newValue: {
      amount: payment.amount,
      method: payment.method,
      isManual: true,
      docNumber: payment.docNumber,
    },
    reason: "Qo'lda to'lov kiritildi",
  });

  await notifyStudentPaid(parsed.data.studentId, payment.amount);

  revalidatePath("/payments");
  return { ok: true };
}

// Onlayn to'lov (demo provayder callback) — TZ FR-PAY-01 (avto "To'landi" + chek),
// FR-PAY-06 (bir xil tranzaksiya ID ikkinchi marta bloklanadi = idempotentlik).
const onlineSchema = z.object({
  studentId: z.string().min(1),
  amount: z.coerce.number().int().positive(),
  purpose: z.string().min(1),
  method: z.enum(PAYMENT_METHODS),
  transactionId: z.string().optional(),
});

export async function payOnline(_prev: PayState, formData: FormData): Promise<PayState> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.PAYMENTS)) return { error: "forbidden" };

  const parsed = onlineSchema.safeParse({
    studentId: formData.get("studentId"),
    amount: formData.get("amount"),
    purpose: formData.get("purpose"),
    method: formData.get("method") || "CLICK",
    transactionId: formData.get("transactionId") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  const txId = parsed.data.transactionId?.trim() || `ONLINE-${randomUUID().slice(0, 8).toUpperCase()}`;

  // Idempotentlik — bir xil tranzaksiya ID ikkinchi marta kelmasin
  const existing = await prisma.payment.findUnique({ where: { transactionId: txId } });
  if (existing) return { error: "duplicate" };

  const payment = await prisma.payment.create({
    data: {
      studentId: parsed.data.studentId,
      amount: parsed.data.amount,
      method: parsed.data.method,
      purpose: parsed.data.purpose,
      status: "PAID",
      isManual: false,
      transactionId: txId,
      docNumber: `CHK-${txId}`,
    },
  });

  await writeAudit({
    actorId: s.userId,
    action: "CREATE",
    entityType: "Payment",
    entityId: payment.id,
    newValue: { amount: payment.amount, method: payment.method, transactionId: txId, online: true },
    reason: "Onlayn to'lov (provayder callback)",
  });

  await notifyStudentPaid(parsed.data.studentId, payment.amount);

  revalidatePath("/payments");
  return { ok: true };
}

// O'quvchining (va bog'langan ota-onasining) hisobiga bildirishnoma
async function notifyStudentPaid(studentId: string, amount: number) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { parents: { include: { parent: true } } },
  });
  if (!student) return;
  const title = "To'lov qabul qilindi";
  const body = `${formatMoney(amount)} — status: To'landi. Chek shaxsiy kabinetda.`;
  if (student.userId) await notify({ userId: student.userId, title, body, event: "payment_success" });
  for (const link of student.parents) {
    if (link.parent.userId) await notify({ userId: link.parent.userId, title, body, event: "payment_success" });
  }
}

// O'chirish TAQIQLANADI — faqat "bekor qilish" (TZ FR-PAY-04)
export async function cancelPayment(paymentId: string, reason: string): Promise<void> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.PAYMENTS)) return;
  if (!reason || reason.trim().length < 3) return;

  const before = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!before || before.status === "CANCELLED") return;

  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
  });

  await writeAudit({
    actorId: s.userId,
    action: "CANCEL",
    entityType: "Payment",
    entityId: paymentId,
    oldValue: { status: before.status },
    newValue: { status: "CANCELLED" },
    reason,
  });

  revalidatePath("/payments");
}
