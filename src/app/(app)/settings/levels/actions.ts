"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { isLevelCode, isSafeBanner } from "@/lib/levelColor";

// Daraja katalogi — menejer va rahbariyat boshqaradi
const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.MANAGER];

export type LevelState = { ok?: boolean; error?: string };

async function guard() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return null;
  return s;
}

function refresh() {
  revalidatePath("/settings/levels");
  revalidatePath("/student/kurse", "layout");
  revalidatePath("/courses", "layout");
}

export type LevelInput = {
  code: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  nameDe: string;
  color: string;
};

function clean(input: LevelInput) {
  const code = input.code.trim();
  const nameUz = input.nameUz.trim();
  if (!isLevelCode(code)) return { error: "Kod noto'g'ri (masalan: A1, B2.1)" } as const;
  if (!nameUz) return { error: "O'zbekcha nomni to'ldiring" } as const;
  if (!/^#[\da-fA-F]{6}$/.test(input.color)) return { error: "Rang noto'g'ri" } as const;
  return {
    data: {
      code,
      nameUz,
      // Tarjima kiritilmasa — o'zbekchasi ishlatiladi
      nameRu: input.nameRu.trim() || nameUz,
      nameEn: input.nameEn.trim() || nameUz,
      nameDe: input.nameDe.trim() || nameUz,
      color: input.color.toLowerCase(),
    },
  } as const;
}

export async function createLevel(input: LevelInput): Promise<LevelState> {
  const s = await guard();
  if (!s) return { error: "Ruxsat yo'q" };

  const c = clean(input);
  if ("error" in c) return { error: c.error };

  const dup = await prisma.studyLevel.findUnique({ where: { code: c.data.code }, select: { id: true } });
  if (dup) return { error: "Bu kod allaqachon bor" };

  const last = await prisma.studyLevel.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const row = await prisma.studyLevel.create({
    data: { ...c.data, sortOrder: (last?.sortOrder ?? -1) + 1 },
    select: { id: true },
  });

  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "StudyLevel", entityId: row.id, newValue: c.data, reason: "Yangi daraja qo'shildi" });
  refresh();
  return { ok: true };
}

export async function updateLevel(id: string, input: LevelInput): Promise<LevelState> {
  const s = await guard();
  if (!s) return { error: "Ruxsat yo'q" };

  const c = clean(input);
  if ("error" in c) return { error: c.error };

  const cur = await prisma.studyLevel.findUnique({ where: { id }, select: { code: true } });
  if (!cur) return { error: "Daraja topilmadi" };

  if (cur.code !== c.data.code) {
    const dup = await prisma.studyLevel.findUnique({ where: { code: c.data.code }, select: { id: true } });
    if (dup) return { error: "Bu kod allaqachon bor" };
  }

  await prisma.studyLevel.update({ where: { id }, data: c.data });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "StudyLevel", entityId: id, oldValue: cur, newValue: c.data, reason: "Daraja tahrirlandi" });
  refresh();
  return { ok: true };
}

export async function setLevelBanner(id: string, url: string | null): Promise<LevelState> {
  const s = await guard();
  if (!s) return { error: "Ruxsat yo'q" };
  if (url !== null && !isSafeBanner(url)) return { error: "Rasm manzili noto'g'ri" };

  await prisma.studyLevel.update({ where: { id }, data: { bannerUrl: url } });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "StudyLevel", entityId: id, newValue: { bannerUrl: url }, reason: url ? "Daraja banneri yuklandi" : "Daraja banneri o'chirildi" });
  refresh();
  return { ok: true };
}

export async function toggleLevel(id: string, on: boolean): Promise<LevelState> {
  const s = await guard();
  if (!s) return { error: "Ruxsat yo'q" };

  await prisma.studyLevel.update({ where: { id }, data: { isActive: on } });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "StudyLevel", entityId: id, newValue: { isActive: on }, reason: on ? "Daraja yoqildi" : "Daraja o'chirildi" });
  refresh();
  return { ok: true };
}

/** Ro'yxatdagi o'rnini bir pog'ona yuqoriga/pastga suradi */
export async function moveLevel(id: string, dir: "up" | "down"): Promise<LevelState> {
  const s = await guard();
  if (!s) return { error: "Ruxsat yo'q" };

  const all = await prisma.studyLevel.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }], select: { id: true } });
  const i = all.findIndex((l) => l.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= all.length) return { ok: true };

  [all[i], all[j]] = [all[j], all[i]];
  await prisma.$transaction(all.map((l, k) => prisma.studyLevel.update({ where: { id: l.id }, data: { sortOrder: k } })));
  refresh();
  return { ok: true };
}

/**
 * Darajani butunlay o'chirish. Kod biror joyda ishlatilayotgan bo'lsa
 * (dars, guruh, material, sertifikat) — o'chirilmaydi, chunki o'sha
 * yozuvlar bog'lanishini yo'qotadi. Bunday holda "o'chirish" tugmasi
 * o'rniga darajani vaqtincha o'chirib qo'yish tavsiya etiladi.
 */
export async function deleteLevel(id: string): Promise<LevelState> {
  const s = await guard();
  if (!s) return { error: "Ruxsat yo'q" };

  const row = await prisma.studyLevel.findUnique({ where: { id }, select: { code: true } });
  if (!row) return { error: "Daraja topilmadi" };

  const [lessons, groups, materials, certs] = await Promise.all([
    prisma.courseLesson.count({ where: { levelCode: row.code } }),
    prisma.group.count({ where: { levelCode: row.code } }),
    prisma.courseMaterial.count({ where: { levelCode: row.code } }),
    prisma.certificate.count({ where: { levelCode: row.code } }),
  ]);
  const used = lessons + groups + materials + certs;
  if (used > 0) {
    const parts = [
      lessons ? `${lessons} dars` : "",
      groups ? `${groups} guruh` : "",
      materials ? `${materials} material` : "",
      certs ? `${certs} sertifikat` : "",
    ].filter(Boolean).join(", ");
    return { error: `O'chirib bo'lmaydi — bu darajadan foydalanilmoqda (${parts}). Uni o'chirish o'rniga vaqtincha o'chirib qo'ying.` };
  }

  await prisma.studyLevel.delete({ where: { id } });
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "StudyLevel", entityId: id, oldValue: row, reason: "Daraja o'chirildi" });
  refresh();
  return { ok: true };
}
