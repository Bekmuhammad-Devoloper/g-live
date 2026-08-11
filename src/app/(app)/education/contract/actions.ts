"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { ROLES, CONTRACT_TEMPLATE_TYPES } from "@/lib/constants";

// Shartnomani boshqaruvchi rollar (rahbariyat)
const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];

export type FormState = { ok?: boolean; error?: string };

const schema = z.object({
  title: z.string().min(2),
  type: z.enum(CONTRACT_TEMPLATE_TYPES),
  content: z.string().optional(),
  note: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function createContractTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };

  const parsed = schema.safeParse({
    title: formData.get("title"),
    type: formData.get("type") || "STANDARD",
    content: formData.get("content") || undefined,
    note: formData.get("note") || undefined,
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
  });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  const created = await prisma.contractTemplate.create({
    data: {
      title: d.title,
      type: d.type,
      content: d.content || null,
      note: d.note || null,
      isActive: d.isActive ?? true,
    },
  });
  await writeAudit({
    actorId: s.userId,
    action: "CREATE",
    entityType: "ContractTemplate",
    entityId: created.id,
    newValue: { title: created.title, type: created.type },
  });
  revalidatePath("/education/contract");
  return { ok: true };
}

export async function deleteContractTemplate(id: string): Promise<void> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return;

  const existing = await prisma.contractTemplate.findUnique({ where: { id } });
  if (!existing) return;

  await prisma.contractTemplate.delete({ where: { id } });
  await writeAudit({
    actorId: s.userId,
    action: "DELETE",
    entityType: "ContractTemplate",
    entityId: id,
    oldValue: { title: existing.title, type: existing.type },
  });
  revalidatePath("/education/contract");
}
