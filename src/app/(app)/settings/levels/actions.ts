"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { ROLES, type Locale } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { tr } from "@/lib/tr";
import { isLevelCode, isSafeBanner } from "@/lib/levelColor";

// Daraja katalogi — menejer va rahbariyat boshqaradi
const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.MANAGER];

export type LevelState = { ok?: boolean; error?: string };

async function guard() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { s, error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };
  return { s, error: null as string | null };
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

function clean(locale: Locale, input: LevelInput) {
  const code = input.code.trim();
  const nameUz = input.nameUz.trim();
  if (!isLevelCode(code)) return { error: tr(locale, { uz: "Kod noto'g'ri (masalan: A1, B2.1)", ru: "Неверный код (например: A1, B2.1)", en: "Invalid code (e.g. A1, B2.1)", de: "Ungültiger Code (z. B. A1, B2.1)" }) } as const;
  if (!nameUz) return { error: tr(locale, { uz: "O'zbekcha nomni to'ldiring", ru: "Заполните название на узбекском", en: "Fill in the Uzbek name", de: "Geben Sie den usbekischen Namen ein" }) } as const;
  if (!/^#[\da-fA-F]{6}$/.test(input.color)) return { error: tr(locale, { uz: "Rang noto'g'ri", ru: "Неверный цвет", en: "Invalid color", de: "Ungültige Farbe" }) } as const;
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
  const { s, error } = await guard();
  if (error) return { error };

  const c = clean(s.locale, input);
  if ("error" in c) return { error: c.error };

  const dup = await prisma.studyLevel.findUnique({ where: { code: c.data.code }, select: { id: true } });
  if (dup) return { error: tr(s.locale, { uz: "Bu kod allaqachon bor", ru: "Такой код уже существует", en: "This code already exists", de: "Dieser Code existiert bereits" }) };

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
  const { s, error } = await guard();
  if (error) return { error };

  const c = clean(s.locale, input);
  if ("error" in c) return { error: c.error };

  const cur = await prisma.studyLevel.findUnique({ where: { id }, select: { code: true } });
  if (!cur) return { error: tr(s.locale, { uz: "Daraja topilmadi", ru: "Уровень не найден", en: "Level not found", de: "Stufe nicht gefunden" }) };

  if (cur.code !== c.data.code) {
    const dup = await prisma.studyLevel.findUnique({ where: { code: c.data.code }, select: { id: true } });
    if (dup) return { error: tr(s.locale, { uz: "Bu kod allaqachon bor", ru: "Такой код уже существует", en: "This code already exists", de: "Dieser Code existiert bereits" }) };
  }

  await prisma.studyLevel.update({ where: { id }, data: c.data });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "StudyLevel", entityId: id, oldValue: cur, newValue: c.data, reason: "Daraja tahrirlandi" });
  refresh();
  return { ok: true };
}

export async function setLevelBanner(id: string, url: string | null): Promise<LevelState> {
  const { s, error } = await guard();
  if (error) return { error };
  if (url !== null && !isSafeBanner(url)) return { error: tr(s.locale, { uz: "Rasm manzili noto'g'ri", ru: "Неверный адрес изображения", en: "Invalid image URL", de: "Ungültige Bild-URL" }) };

  await prisma.studyLevel.update({ where: { id }, data: { bannerUrl: url } });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "StudyLevel", entityId: id, newValue: { bannerUrl: url }, reason: url ? "Daraja banneri yuklandi" : "Daraja banneri o'chirildi" });
  refresh();
  return { ok: true };
}

export async function toggleLevel(id: string, on: boolean): Promise<LevelState> {
  const { s, error } = await guard();
  if (error) return { error };

  await prisma.studyLevel.update({ where: { id }, data: { isActive: on } });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "StudyLevel", entityId: id, newValue: { isActive: on }, reason: on ? "Daraja yoqildi" : "Daraja o'chirildi" });
  refresh();
  return { ok: true };
}

/** Ro'yxatdagi o'rnini bir pog'ona yuqoriga/pastga suradi */
export async function moveLevel(id: string, dir: "up" | "down"): Promise<LevelState> {
  const { s, error } = await guard();
  if (error) return { error };

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
  const { s, error } = await guard();
  if (error) return { error };

  const row = await prisma.studyLevel.findUnique({ where: { id }, select: { code: true } });
  if (!row) return { error: tr(s.locale, { uz: "Daraja topilmadi", ru: "Уровень не найден", en: "Level not found", de: "Stufe nicht gefunden" }) };

  const [lessons, groups, materials, certs] = await Promise.all([
    prisma.courseLesson.count({ where: { levelCode: row.code } }),
    prisma.group.count({ where: { levelCode: row.code } }),
    prisma.courseMaterial.count({ where: { levelCode: row.code } }),
    prisma.certificate.count({ where: { levelCode: row.code } }),
  ]);
  const used = lessons + groups + materials + certs;
  if (used > 0) {
    const parts = [
      lessons ? tr(s.locale, { uz: `${lessons} dars`, ru: `уроков: ${lessons}`, en: `${lessons} lessons`, de: `${lessons} Lektionen` }) : "",
      groups ? tr(s.locale, { uz: `${groups} guruh`, ru: `групп: ${groups}`, en: `${groups} groups`, de: `${groups} Gruppen` }) : "",
      materials ? tr(s.locale, { uz: `${materials} material`, ru: `материалов: ${materials}`, en: `${materials} materials`, de: `${materials} Materialien` }) : "",
      certs ? tr(s.locale, { uz: `${certs} sertifikat`, ru: `сертификатов: ${certs}`, en: `${certs} certificates`, de: `${certs} Zertifikate` }) : "",
    ].filter(Boolean).join(", ");
    return {
      error: tr(s.locale, {
        uz: `O'chirib bo'lmaydi — bu darajadan foydalanilmoqda (${parts}). Uni o'chirish o'rniga vaqtincha o'chirib qo'ying.`,
        ru: `Нельзя удалить — этот уровень используется (${parts}). Вместо удаления временно отключите его.`,
        en: `Cannot delete — this level is in use (${parts}). Deactivate it instead of deleting.`,
        de: `Löschen nicht möglich — diese Stufe wird verwendet (${parts}). Deaktivieren Sie sie, statt sie zu löschen.`,
      }),
    };
  }

  await prisma.studyLevel.delete({ where: { id } });
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "StudyLevel", entityId: id, oldValue: row, reason: "Daraja o'chirildi" });
  refresh();
  return { ok: true };
}
