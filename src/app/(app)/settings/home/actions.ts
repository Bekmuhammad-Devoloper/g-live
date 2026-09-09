"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { ROLES, type Locale } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { tr } from "@/lib/tr";
import { isSafeLink } from "@/lib/portalContent";

// O'quvchi bosh sahifasidagi banner va videolar — direktor va menejer
const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.MANAGER, ROLES.ROP];

export type HomeState = { ok?: boolean; error?: string };

async function guard() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { s, error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };
  return { s, error: null as string | null };
}

function refresh() {
  revalidatePath("/settings/home");
  revalidatePath("/student", "layout");
}

/* ══════════ Bannerlar ══════════ */

export type BannerInput = {
  title: string;
  subtitle: string;
  btnLabel: string;
  href: string;
  imageUrl: string;
  color: string;
};

function cleanBanner(locale: Locale, i: BannerInput) {
  const title = i.title.trim().slice(0, 120);
  if (title.length < 2) return { error: tr(locale, { uz: "Sarlavhani to'ldiring", ru: "Заполните заголовок", en: "Fill in the title", de: "Geben Sie den Titel ein" }) } as const;
  const href = i.href.trim();
  if (href && !isSafeLink(href)) return { error: tr(locale, { uz: "Havola noto'g'ri (/student/... yoki https://...)", ru: "Неверная ссылка (/student/... или https://...)", en: "Invalid link (/student/... or https://...)", de: "Ungültiger Link (/student/... oder https://...)" }) } as const;
  const imageUrl = i.imageUrl.trim();
  if (imageUrl && !/^\/uploads\/[\w.-]+$/.test(imageUrl)) return { error: tr(locale, { uz: "Rasm manzili noto'g'ri", ru: "Неверный адрес изображения", en: "Invalid image URL", de: "Ungültige Bild-URL" }) } as const;
  if (!/^#[\da-fA-F]{6}$/.test(i.color)) return { error: tr(locale, { uz: "Rang noto'g'ri", ru: "Неверный цвет", en: "Invalid color", de: "Ungültige Farbe" }) } as const;

  return {
    data: {
      title,
      subtitle: i.subtitle.trim().slice(0, 240) || null,
      btnLabel: i.btnLabel.trim().slice(0, 40) || null,
      href: href || null,
      imageUrl: imageUrl || null,
      color: i.color.toLowerCase(),
    },
  } as const;
}

export async function saveBanner(id: string | null, input: BannerInput): Promise<HomeState> {
  const { s, error } = await guard();
  if (error) return { error };

  const c = cleanBanner(s.locale, input);
  if ("error" in c) return { error: c.error };

  if (id) {
    await prisma.portalBanner.update({ where: { id }, data: c.data });
  } else {
    const last = await prisma.portalBanner.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    await prisma.portalBanner.create({ data: { ...c.data, sortOrder: (last?.sortOrder ?? -1) + 1 } });
  }

  await writeAudit({
    actorId: s.userId,
    action: id ? "UPDATE" : "CREATE",
    entityType: "PortalBanner",
    entityId: id,
    newValue: c.data,
    reason: "Bosh sahifa banneri",
  });
  refresh();
  return { ok: true };
}

export async function deleteBanner(id: string): Promise<HomeState> {
  const { s, error } = await guard();
  if (error) return { error };
  await prisma.portalBanner.delete({ where: { id } });
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "PortalBanner", entityId: id, reason: "Banner o'chirildi" });
  refresh();
  return { ok: true };
}

export async function toggleBanner(id: string, on: boolean): Promise<HomeState> {
  const { s, error } = await guard();
  if (error) return { error };
  await prisma.portalBanner.update({ where: { id }, data: { isActive: on } });
  refresh();
  return { ok: true };
}

export async function moveBanner(id: string, dir: "up" | "down"): Promise<HomeState> {
  const { s, error } = await guard();
  if (error) return { error };
  const all = await prisma.portalBanner.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const i = all.findIndex((x) => x.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= all.length) return { ok: true };
  [all[i], all[j]] = [all[j], all[i]];
  await prisma.$transaction(all.map((x, k) => prisma.portalBanner.update({ where: { id: x.id }, data: { sortOrder: k } })));
  refresh();
  return { ok: true };
}

/* ══════════ Video va podkastlar ══════════ */

export type VideoInput = { title: string; note: string; url: string; kind: string };

export async function saveVideo(id: string | null, input: VideoInput): Promise<HomeState> {
  const { s, error } = await guard();
  if (error) return { error };

  const title = input.title.trim().slice(0, 160);
  if (title.length < 2) return { error: tr(s.locale, { uz: "Sarlavhani to'ldiring", ru: "Заполните заголовок", en: "Fill in the title", de: "Geben Sie den Titel ein" }) };
  const url = input.url.trim();
  if (!isSafeLink(url)) return { error: tr(s.locale, { uz: "Havola noto'g'ri — YouTube havolasini to'liq qo'ying", ru: "Неверная ссылка — вставьте полную ссылку YouTube", en: "Invalid link — paste the full YouTube link", de: "Ungültiger Link — fügen Sie den vollständigen YouTube-Link ein" }) };
  const kind = input.kind === "PODCAST" ? "PODCAST" : "VIDEO";
  const data = { title, note: input.note.trim().slice(0, 300) || null, url, kind };

  if (id) {
    await prisma.portalVideo.update({ where: { id }, data });
  } else {
    const last = await prisma.portalVideo.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    await prisma.portalVideo.create({ data: { ...data, sortOrder: (last?.sortOrder ?? -1) + 1 } });
  }

  await writeAudit({
    actorId: s.userId,
    action: id ? "UPDATE" : "CREATE",
    entityType: "PortalVideo",
    entityId: id,
    newValue: data,
    reason: "Bosh sahifa videosi",
  });
  refresh();
  return { ok: true };
}

export async function deleteVideo(id: string): Promise<HomeState> {
  const { s, error } = await guard();
  if (error) return { error };
  await prisma.portalVideo.delete({ where: { id } });
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "PortalVideo", entityId: id, reason: "Video o'chirildi" });
  refresh();
  return { ok: true };
}

export async function toggleVideo(id: string, on: boolean): Promise<HomeState> {
  const { s, error } = await guard();
  if (error) return { error };
  await prisma.portalVideo.update({ where: { id }, data: { isActive: on } });
  refresh();
  return { ok: true };
}

export async function moveVideo(id: string, dir: "up" | "down"): Promise<HomeState> {
  const { s, error } = await guard();
  if (error) return { error };
  const all = await prisma.portalVideo.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const i = all.findIndex((x) => x.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= all.length) return { ok: true };
  [all[i], all[j]] = [all[j], all[i]];
  await prisma.$transaction(all.map((x, k) => prisma.portalVideo.update({ where: { id: x.id }, data: { sortOrder: k } })));
  refresh();
  return { ok: true };
}
