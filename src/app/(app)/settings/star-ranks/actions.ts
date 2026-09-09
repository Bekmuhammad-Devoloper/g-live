"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { ROLES, type Locale } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { tr } from "@/lib/tr";
import { isSafeBanner } from "@/lib/levelColor";

// Yulduz pog'onalari — menejer va rahbariyat boshqaradi.
// Pog'ona chegarasi (yulduz) va mukofoti (tanga) shu yerdan o'zgaradi;
// o'quvchilarning balansi keyingi ochilishda darhol qayta hisoblanadi.
const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.MANAGER];

export type RankState = { ok?: boolean; error?: string };

async function guard() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { s, error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };
  return { s, error: null as string | null };
}

function refresh() {
  revalidatePath("/settings/star-ranks");
  revalidatePath("/student", "layout");
}

export type RankInput = {
  nameUz: string;
  nameRu: string;
  nameEn: string;
  nameDe: string;
  stars: number;
  reward: number;
  color: string;
  /** Belgi — oynadan yuklanganda keladi (yo'q bo'lsa o'zgarmaydi) */
  iconUrl?: string | null;
};

function clean(locale: Locale, input: RankInput) {
  const nameUz = input.nameUz.trim();
  if (!nameUz) return { error: tr(locale, { uz: "O'zbekcha nomni to'ldiring", ru: "Заполните название на узбекском", en: "Fill in the Uzbek name", de: "Geben Sie den usbekischen Namen ein" }) } as const;

  const stars = Math.trunc(Number(input.stars));
  const reward = Math.trunc(Number(input.reward));
  if (!Number.isFinite(stars) || stars < 0) return { error: tr(locale, { uz: "Yulduz soni 0 dan kichik bo'lmasin", ru: "Количество звёзд не может быть меньше 0", en: "Star count cannot be less than 0", de: "Die Sternanzahl darf nicht kleiner als 0 sein" }) } as const;
  if (!Number.isFinite(reward) || reward < 0) return { error: tr(locale, { uz: "Mukofot 0 dan kichik bo'lmasin", ru: "Награда не может быть меньше 0", en: "Reward cannot be less than 0", de: "Die Belohnung darf nicht kleiner als 0 sein" }) } as const;
  if (!/^#[\da-fA-F]{6}$/.test(input.color)) return { error: tr(locale, { uz: "Rang noto'g'ri", ru: "Неверный цвет", en: "Invalid color", de: "Ungültige Farbe" }) } as const;

  const icon = input.iconUrl ?? null;
  if (icon !== null && !isSafeBanner(icon)) return { error: tr(locale, { uz: "Rasm manzili noto'g'ri", ru: "Неверный адрес изображения", en: "Invalid image URL", de: "Ungültige Bild-URL" }) } as const;

  return {
    data: {
      nameUz,
      // Tarjima kiritilmasa — o'zbekchasi ishlatiladi
      nameRu: input.nameRu.trim() || nameUz,
      nameEn: input.nameEn.trim() || nameUz,
      nameDe: input.nameDe.trim() || nameUz,
      stars,
      reward,
      color: input.color.toLowerCase(),
      iconUrl: icon,
    },
  } as const;
}

/** Bir xil chegarali ikki pog'ona bo'lsa qaysi biri "hozirgi" ekani noaniq bo'ladi */
async function starsTaken(stars: number, exceptId?: string): Promise<boolean> {
  const row = await prisma.starRank.findFirst({
    where: { stars, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  return Boolean(row);
}

export async function createStarRank(input: RankInput): Promise<RankState> {
  const { s, error } = await guard();
  if (error) return { error };

  const c = clean(s.locale, input);
  if ("error" in c) return { error: c.error };
  if (await starsTaken(c.data.stars)) return { error: tr(s.locale, { uz: "Bu yulduz chegarasi allaqachon band", ru: "Этот порог звёзд уже занят", en: "This star threshold is already taken", de: "Diese Sterngrenze ist bereits vergeben" }) };

  const row = await prisma.starRank.create({ data: c.data, select: { id: true } });
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "StarRank", entityId: row.id, newValue: c.data, reason: "Yangi pog'ona qo'shildi" });
  refresh();
  return { ok: true };
}

export async function updateStarRank(id: string, input: RankInput): Promise<RankState> {
  const { s, error } = await guard();
  if (error) return { error };

  const c = clean(s.locale, input);
  if ("error" in c) return { error: c.error };

  const cur = await prisma.starRank.findUnique({
    where: { id },
    select: { nameUz: true, stars: true, reward: true, color: true, iconUrl: true },
  });
  if (!cur) return { error: tr(s.locale, { uz: "Pog'ona topilmadi", ru: "Ступень не найдена", en: "Rank not found", de: "Rang nicht gefunden" }) };
  if (await starsTaken(c.data.stars, id)) return { error: tr(s.locale, { uz: "Bu yulduz chegarasi allaqachon band", ru: "Этот порог звёзд уже занят", en: "This star threshold is already taken", de: "Diese Sterngrenze ist bereits vergeben" }) };

  await prisma.starRank.update({ where: { id }, data: c.data });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "StarRank", entityId: id, oldValue: cur, newValue: c.data, reason: "Pog'ona tahrirlandi" });
  refresh();
  return { ok: true };
}

/** Pog'ona belgisi — /api/upload qaytargan manzil (yoki null: olib tashlash) */
export async function setStarRankIcon(id: string, url: string | null): Promise<RankState> {
  const { s, error } = await guard();
  if (error) return { error };
  if (url !== null && !isSafeBanner(url)) return { error: tr(s.locale, { uz: "Rasm manzili noto'g'ri", ru: "Неверный адрес изображения", en: "Invalid image URL", de: "Ungültige Bild-URL" }) };

  await prisma.starRank.update({ where: { id }, data: { iconUrl: url } });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "StarRank", entityId: id, newValue: { iconUrl: url }, reason: url ? "Pog'ona belgisi yuklandi" : "Pog'ona belgisi o'chirildi" });
  refresh();
  return { ok: true };
}

export async function toggleStarRank(id: string, on: boolean): Promise<RankState> {
  const { s, error } = await guard();
  if (error) return { error };

  await prisma.starRank.update({ where: { id }, data: { isActive: on } });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "StarRank", entityId: id, newValue: { isActive: on }, reason: on ? "Pog'ona yoqildi" : "Pog'ona o'chirildi" });
  refresh();
  return { ok: true };
}

export async function deleteStarRank(id: string): Promise<RankState> {
  const { s, error } = await guard();
  if (error) return { error };

  const row = await prisma.starRank.findUnique({ where: { id }, select: { nameUz: true, stars: true } });
  if (!row) return { error: tr(s.locale, { uz: "Pog'ona topilmadi", ru: "Ступень не найдена", en: "Rank not found", de: "Rang nicht gefunden" }) };

  // Oxirgi pog'ona o'chirilsa ilovada daraja umuman ko'rinmay qoladi
  if ((await prisma.starRank.count()) <= 1) {
    return { error: tr(s.locale, { uz: "Oxirgi pog'onani o'chirib bo'lmaydi — uni o'chirib qo'ying yoki tahrirlang", ru: "Последнюю ступень нельзя удалить — отключите или отредактируйте её", en: "The last rank cannot be deleted — deactivate or edit it instead", de: "Der letzte Rang kann nicht gelöscht werden — deaktivieren oder bearbeiten Sie ihn" }) };
  }

  await prisma.starRank.delete({ where: { id } });
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "StarRank", entityId: id, oldValue: row, reason: "Pog'ona o'chirildi" });
  refresh();
  return { ok: true };
}
