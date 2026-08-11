"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canWrite, MODULES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";

export type FormState = { ok?: boolean; error?: string };

const schema = z.object({
  studentId: z.string().min(1),
  programName: z.string().min(2),
  levelCode: z.string().optional(),
  result: z.string().optional(),
  examScore: z.coerce.number().int().min(0).max(100).optional(),
});

// Sertifikat berish — TZ FR-EXM-04/05 (noyob raqam + ishlaydigan QR, vakolatli xodim).
export async function issueCertificate(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CERTIFICATES)) return { error: "forbidden" };

  const parsed = schema.safeParse({
    studentId: formData.get("studentId"),
    programName: formData.get("programName"),
    levelCode: formData.get("levelCode") || undefined,
    result: formData.get("result") || undefined,
    examScore: formData.get("examScore") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  // Noyob raqam va QR-token
  const year = new Date().getFullYear();
  const rand = randomUUID().slice(0, 6).toUpperCase();
  const number = `GL-${year}-${rand}`;
  const qrCode = randomUUID();

  const cert = await prisma.certificate.create({
    data: {
      studentId: parsed.data.studentId,
      programName: parsed.data.programName,
      levelCode: parsed.data.levelCode || null,
      result: parsed.data.result || (parsed.data.examScore != null ? `${parsed.data.examScore}%` : null),
      number,
      qrCode,
      status: "ISSUED",
      issuedBy: s.fullName,
    },
  });

  // Ta'lim statusini yangilash + audit + bildirishnoma
  await prisma.student.update({ where: { id: parsed.data.studentId }, data: { eduStatus: "CERTIFIED" } });
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "Certificate", entityId: cert.id, newValue: { number } });

  const student = await prisma.student.findUnique({ where: { id: parsed.data.studentId } });
  if (student?.userId) await notify({ userId: student.userId, title: "Sertifikat berildi", body: `${cert.programName} — ${number}`, event: "certificate" });

  revalidatePath("/certificates");
  return { ok: true };
}

// Sertifikatni bekor qilish — TZ FR-EXM-06
export async function revokeCertificate(id: string, reason: string): Promise<void> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CERTIFICATES)) return;
  if (!reason || reason.trim().length < 3) return;

  const before = await prisma.certificate.findUnique({ where: { id } });
  if (!before || before.status === "REVOKED") return;

  await prisma.certificate.update({ where: { id }, data: { status: "REVOKED" } });
  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "Certificate",
    entityId: id,
    oldValue: { status: before.status },
    newValue: { status: "REVOKED" },
    reason,
  });
  revalidatePath("/certificates");
}
