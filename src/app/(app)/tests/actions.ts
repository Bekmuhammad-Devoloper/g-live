"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { writeAudit } from "@/lib/audit";

export type FormState = { ok?: boolean; error?: string };

const CAN = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.TEACHER];
function canManage(role: string) { return CAN.includes(role as never); }
const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
const cleanIds = (raw?: string) => (raw ? Array.from(new Set(raw.split(",").map((x) => x.trim()).filter(Boolean))).join(",") : null);

// ─── Blok test (imtihon) ───
const examSchema = z.object({
  title: z.string().min(2),
  type: z.enum(["KIRISH", "BLOCK", "YAKUNIY"]).default("BLOCK"),
  status: z.enum(["PLANNED", "ACTIVE", "FINISHED"]).default("PLANNED"),
  date: z.string().optional(),
  startTime: z.string().optional(),
  durationMin: z.coerce.number().int().min(0).max(1000),
  responsibleId: z.string().optional(),
  groupIds: z.string().optional(),
});

export async function createBlockTest(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireSession();
  if (!canManage(s.role)) return { error: "forbidden" };
  const parsed = examSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type") || "BLOCK",
    status: formData.get("status") || "PLANNED",
    date: formData.get("date") || undefined,
    startTime: formData.get("startTime") || undefined,
    durationMin: formData.get("durationMin") || 60,
    responsibleId: formData.get("responsibleId") || undefined,
    groupIds: formData.get("groupIds") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  const bt = await prisma.blockTest.create({
    data: {
      title: parsed.data.title,
      type: parsed.data.type,
      status: parsed.data.status,
      date: parsed.data.date ? new Date(parsed.data.date) : null,
      startTime: parsed.data.startTime && timeRe.test(parsed.data.startTime) ? parsed.data.startTime : null,
      durationMin: parsed.data.durationMin,
      responsibleId: parsed.data.responsibleId || null,
      groupIds: cleanIds(parsed.data.groupIds),
      branchId: s.branchId, // faol filialga biriktiriladi
    },
  });
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "BlockTest", entityId: bt.id, newValue: { title: bt.title } });
  revalidatePath("/tests");
  return { ok: true };
}

// ─── Test turi ───
const typeSchema = z.object({
  name: z.string().min(2),
  code: z.string().optional(),
  durationMin: z.coerce.number().int().min(0).max(1000),
  courseIds: z.string().optional(),
});

export async function createTestType(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireSession();
  if (!canManage(s.role)) return { error: "forbidden" };
  const parsed = typeSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code") || undefined,
    durationMin: formData.get("durationMin") || 0,
    courseIds: formData.get("courseIds") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  const tt = await prisma.testType.create({
    data: {
      name: parsed.data.name,
      code: parsed.data.code || null,
      durationMin: parsed.data.durationMin,
      courseIds: cleanIds(parsed.data.courseIds),
    },
  });
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "TestType", entityId: tt.id, newValue: { name: tt.name } });
  revalidatePath("/tests");
  return { ok: true };
}
