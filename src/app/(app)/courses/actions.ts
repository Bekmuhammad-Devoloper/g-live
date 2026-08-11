"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { ROLES } from "@/lib/constants";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];

export type CourseState = { ok?: boolean; error?: string; id?: string };

const schema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
});

// Bannerlarni JSON'dan tozalab, faqat data:image URL'larni qaytaradi (maks 6 ta)
function parseBanners(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === "string" && /^data:image\/(png|jpe?g|webp|gif);base64,/.test(x) && x.length < 800_000).slice(0, 6);
  } catch { return []; }
}

export async function createCourse(_prev: CourseState, formData: FormData): Promise<CourseState> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };

  const parsed = schema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  const banners = parseBanners(formData.get("banners"));
  const p = await prisma.program.create({
    data: { name: parsed.data.name, description: parsed.data.description || null, banners: banners.length ? JSON.stringify(banners) : null },
  });
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "Program", entityId: p.id, newValue: { name: p.name, banners: banners.length } });
  revalidatePath("/courses");
  return { ok: true, id: p.id };
}

// Kursni tahrirlash
export async function updateCourse(id: string, _prev: CourseState, formData: FormData): Promise<CourseState> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };

  const parsed = schema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  const existing = await prisma.program.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { error: "invalid" };

  const banners = parseBanners(formData.get("banners"));
  await prisma.program.update({
    where: { id },
    data: { name: parsed.data.name, description: parsed.data.description || null, banners: banners.length ? JSON.stringify(banners) : null },
  });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Program", entityId: id, newValue: { name: parsed.data.name, banners: banners.length } });
  revalidatePath("/courses");
  revalidatePath(`/courses/${id}`);
  return { ok: true, id };
}

// Kursni o'chirish (guruhlari bo'lsa o'chirilmaydi)
export async function deleteCourse(id: string): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };

  const groups = await prisma.group.count({ where: { programId: id } });
  if (groups > 0) return { error: "has-groups" };

  await prisma.program.delete({ where: { id } });
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "Program", entityId: id });
  revalidatePath("/courses");
  return { ok: true };
}

// ─── Daraja (Level) ───
const levelSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  weeks: z.coerce.number().int().min(0).max(200).optional(),
  academicHours: z.coerce.number().int().min(0).max(2000).optional(),
  passScore: z.coerce.number().int().min(0).max(100).optional(),
});

export async function createLevel(programId: string, _prev: CourseState, formData: FormData): Promise<CourseState> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };

  const parsed = levelSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    weeks: formData.get("weeks") || undefined,
    academicHours: formData.get("academicHours") || undefined,
    passScore: formData.get("passScore") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  const order = await prisma.level.count({ where: { programId } });
  try {
    await prisma.level.create({
      data: {
        programId, order,
        code: parsed.data.code.trim(),
        name: parsed.data.name.trim(),
        weeks: parsed.data.weeks ?? null,
        academicHours: parsed.data.academicHours ?? null,
        passScore: parsed.data.passScore ?? null,
      },
    });
  } catch {
    return { error: "duplicate" }; // bir xil kod (programId+code unique)
  }
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "Level", entityId: programId, newValue: { code: parsed.data.code } });
  revalidatePath(`/courses/${programId}`);
  return { ok: true, id: programId };
}

export async function deleteLevel(id: string): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };
  const lv = await prisma.level.findUnique({ where: { id }, select: { programId: true } });
  if (!lv) return { error: "notfound" };
  await prisma.level.delete({ where: { id } });
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "Level", entityId: id });
  revalidatePath(`/courses/${lv.programId}`);
  return { ok: true };
}

// ─── Material ───
const materialSchema = z.object({
  title: z.string().min(1),
  kind: z.enum(["LINK", "VIDEO", "FILE", "DOC"]).optional(),
  url: z.string().optional(),
  levelCode: z.string().optional(),
  note: z.string().optional(),
});

export async function createMaterial(programId: string, _prev: CourseState, formData: FormData): Promise<CourseState> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };

  const parsed = materialSchema.safeParse({
    title: formData.get("title"),
    kind: formData.get("kind") || undefined,
    url: formData.get("url") || undefined,
    levelCode: formData.get("levelCode") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  await prisma.courseMaterial.create({
    data: {
      programId,
      title: parsed.data.title.trim(),
      kind: parsed.data.kind ?? "LINK",
      url: parsed.data.url?.trim() || null,
      levelCode: parsed.data.levelCode?.trim() || null,
      note: parsed.data.note?.trim() || null,
    },
  });
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "CourseMaterial", entityId: programId, newValue: { title: parsed.data.title } });
  revalidatePath(`/courses/${programId}`);
  return { ok: true, id: programId };
}

export async function deleteMaterial(id: string): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };
  const m = await prisma.courseMaterial.findUnique({ where: { id }, select: { programId: true } });
  if (!m) return { error: "notfound" };
  await prisma.courseMaterial.delete({ where: { id } });
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "CourseMaterial", entityId: id });
  revalidatePath(`/courses/${m.programId}`);
  return { ok: true };
}
