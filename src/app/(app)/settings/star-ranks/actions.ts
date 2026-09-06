"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { isSafeBanner } from "@/lib/levelColor";

// Yulduz pog'onalari — menejer va rahbariyat boshqaradi.
// Pog'ona chegarasi (yulduz) va mukofoti (tanga) shu yerdan o'zgaradi;
// o'quvchilarning balansi keyingi ochilishda darhol qayta hisoblanadi.
const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.MANAGER];

export type RankState = { ok?: boolean; error?: string };

async function guard() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return null;
  return s;
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

function clean(input: RankInput) {
  const nameUz = input.nameUz.trim();
  if (!nameUz) return { error: "O'zbekcha nomni to'ldiring" } as const;

  const stars = Math.trunc(Number(input.stars));
  const reward = Math.trunc(Number(input.reward));
  if (!Number.isFinite(stars) || stars < 0) return { error: "Yulduz soni 0 dan kichik bo'lmasin" } as const;
  if (!Number.isFinite(reward) || reward < 0) return { error: "Mukofot 0 dan kichik bo'lmasin" } as const;
  if (!/^#[\da-fA-F]{6}$/.test(input.color)) return { error: "Rang noto'g'ri" } as const;

  const icon = input.iconUrl ?? null;
  if (icon !== null && !isSafeBanner(icon)) return { error: "Rasm manzili noto'g'ri" } as const;

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
  const s = await guard();
  if (!s) return { error: "Ruxsat yo'q" };

  const c = clean(input);
  if ("error" in c) return { error: c.error };
  if (await starsTaken(c.data.stars)) return { error: "Bu yulduz chegarasi allaqachon band" };

  const row = await prisma.starRank.create({ data: c.data, select: { id: true } });
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "StarRank", entityId: row.id, newValue: c.data, reason: "Yangi pog'ona qo'shildi" });
  refresh();
  return { ok: true };
}

export async function updateStarRank(id: string, input: RankInput): Promise<RankState> {
  const s = await guard();
  if (!s) return { error: "Ruxsat yo'q" };

  const c = clean(input);
  if ("error" in c) return { error: c.error };

  const cur = await prisma.starRank.findUnique({
    where: { id },
    select: { nameUz: true, stars: true, reward: true, color: true, iconUrl: true },
  });
  if (!cur) return { error: "Pog'ona topilmadi" };
  if (await starsTaken(c.data.stars, id)) return { error: "Bu yulduz chegarasi allaqachon band" };

  await prisma.starRank.update({ where: { id }, data: c.data });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "StarRank", entityId: id, oldValue: cur, newValue: c.data, reason: "Pog'ona tahrirlandi" });
  refresh();
  return { ok: true };
}

/** Pog'ona belgisi — /api/upload qaytargan manzil (yoki null: olib tashlash) */
export async function setStarRankIcon(id: string, url: string | null): Promise<RankState> {
  const s = await guard();
  if (!s) return { error: "Ruxsat yo'q" };
  if (url !== null && !isSafeBanner(url)) return { error: "Rasm manzili noto'g'ri" };

  await prisma.starRank.update({ where: { id }, data: { iconUrl: url } });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "StarRank", entityId: id, newValue: { iconUrl: url }, reason: url ? "Pog'ona belgisi yuklandi" : "Pog'ona belgisi o'chirildi" });
  refresh();
  return { ok: true };
}

export async function toggleStarRank(id: string, on: boolean): Promise<RankState> {
  const s = await guard();
  if (!s) return { error: "Ruxsat yo'q" };

  await prisma.starRank.update({ where: { id }, data: { isActive: on } });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "StarRank", entityId: id, newValue: { isActive: on }, reason: on ? "Pog'ona yoqildi" : "Pog'ona o'chirildi" });
  refresh();
  return { ok: true };
}

export async function deleteStarRank(id: string): Promise<RankState> {
  const s = await guard();
  if (!s) return { error: "Ruxsat yo'q" };

  const row = await prisma.starRank.findUnique({ where: { id }, select: { nameUz: true, stars: true } });
  if (!row) return { error: "Pog'ona topilmadi" };

  // Oxirgi pog'ona o'chirilsa ilovada daraja umuman ko'rinmay qoladi
  if ((await prisma.starRank.count()) <= 1) {
    return { error: "Oxirgi pog'onani o'chirib bo'lmaydi — uni o'chirib qo'ying yoki tahrirlang" };
  }

  await prisma.starRank.delete({ where: { id } });
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "StarRank", entityId: id, oldValue: row, reason: "Pog'ona o'chirildi" });
  refresh();
  return { ok: true };
}
