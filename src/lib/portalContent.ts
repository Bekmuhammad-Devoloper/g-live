import "server-only";
import { cache } from "react";
import { prisma } from "./db";

// O'quvchi bosh sahifasidagi banner va videolar.
// Direktor va menejer Sozlamalar > Bosh sahifa bo'limidan boshqaradi.

export type BannerRow = {
  id: string;
  title: string;
  subtitle: string | null;
  btnLabel: string | null;
  href: string | null;
  imageUrl: string | null;
  color: string;
  sortOrder: number;
  isActive: boolean;
};

export type VideoRow = {
  id: string;
  title: string;
  note: string | null;
  url: string;
  kind: string;
  sortOrder: number;
  isActive: boolean;
};

const BANNER_SELECT = {
  id: true, title: true, subtitle: true, btnLabel: true, href: true,
  imageUrl: true, color: true, sortOrder: true, isActive: true,
} as const;

const VIDEO_SELECT = {
  id: true, title: true, note: true, url: true, kind: true, sortOrder: true, isActive: true,
} as const;

// Birinchi ochilishda ilovadagi hozirgi banner saqlanadi — bosh sahifa
// bo'sh qolmasin, ma'muriyat esa uni tahrirlab ketaveradi.
const DEFAULT_BANNER = {
  title: "Deutsch meistern mit Spaß! ✨",
  subtitle: "Interaktive Übungen, Videos und spannende Inhalte.",
  btnLabel: "Jetzt entdecken",
  href: "/student/kurse",
  color: "#0e7490",
  sortOrder: 0,
};

export const getBanners = cache(async (): Promise<BannerRow[]> => {
  const n = await prisma.portalBanner.count();
  if (n === 0) await prisma.portalBanner.create({ data: DEFAULT_BANNER });
  return prisma.portalBanner.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: BANNER_SELECT,
  });
});

export const getActiveBanners = cache(async (): Promise<BannerRow[]> =>
  (await getBanners()).filter((b) => b.isActive));

export const getVideos = cache(async (): Promise<VideoRow[]> =>
  prisma.portalVideo.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: VIDEO_SELECT,
  }));

export const getActiveVideos = cache(async (): Promise<VideoRow[]> =>
  (await getVideos()).filter((v) => v.isActive));

/** YouTube/Vimeo havolasidan video id sini ajratamiz */
export function videoId(u: string): { host: "youtube" | "vimeo"; id: string } | null {
  const yt = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/.exec(u);
  if (yt) return { host: "youtube", id: yt[1] };
  const vm = /vimeo\.com\/(?:video\/)?(\d+)/.exec(u);
  if (vm) return { host: "vimeo", id: vm[1] };
  return null;
}

/** Ro'yxatda ko'rinadigan kichik rasm (YouTube o'zi beradi) */
export function videoThumb(u: string): string | null {
  const v = videoId(u);
  return v?.host === "youtube" ? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` : null;
}

/** Sahifa ichida ochiladigan pleyer manzili */
export function videoEmbed(u: string): string | null {
  const v = videoId(u);
  if (!v) return null;
  return v.host === "youtube"
    ? `https://www.youtube.com/embed/${v.id}`
    : `https://player.vimeo.com/video/${v.id}`;
}

/** Faqat ishonchli manzil: o'z serverimiz yoki https havola */
export const isSafeLink = (u: string) => /^(\/[\w./-]*|https:\/\/[\w.-]+(\/[^\s]*)?)$/.test(u.trim());
