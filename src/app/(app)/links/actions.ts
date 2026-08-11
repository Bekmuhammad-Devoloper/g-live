"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canWrite, MODULES } from "@/lib/rbac";
import { tr } from "@/lib/tr";
import { writeAudit } from "@/lib/audit";
import type { CreatedLink } from "./types";
import { parseQuestions, serializeQuestions } from "./questions";

export type FormState = { ok?: boolean; error?: string; links?: CreatedLink[] };

const can = (role: string) => canWrite(role, MODULES.CRM);

// ── Kod generatsiyasi (kolliziyaga qarshi retry bilan) ──
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
function randCode(len: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}
async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = randCode(i < 4 ? 8 : 10);
    const exists = await prisma.vacancyLink.findUnique({ where: { code }, select: { id: true } });
    if (!exists) return code;
  }
  return randCode(12);
}

function parsePlatforms(fd: FormData): string[] {
  const arr = fd.getAll("platforms").map((v) => String(v)).filter(Boolean);
  return Array.from(new Set(arr.length ? arr : ["other"]));
}
function parseExpiry(v: FormDataEntryValue | null): Date | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

async function createLinks(vacancyId: string, platforms: string[], fd: FormData, actorName: string, actorId: string) {
  const utmSource = String(fd.get("utmSource") || "").trim() || null;
  const utmMedium = String(fd.get("utmMedium") || "").trim() || null;
  const utmCampaign = String(fd.get("utmCampaign") || "").trim() || null;
  const expiresAt = parseExpiry(fd.get("expiresAt"));
  const maxSubmissions = Number(fd.get("maxSubmissions")) > 0 ? Math.round(Number(fd.get("maxSubmissions"))) : null;

  const name = String(fd.get("name") || "").trim() || null;

  const created: CreatedLink[] = [];
  for (const p of platforms) {
    const code = await uniqueCode();
    await prisma.vacancyLink.create({
      data: {
        code, platform: p, vacancyId, name,
        utmSource: utmSource ?? p, utmMedium, utmCampaign,
        expiresAt, maxSubmissions,
        createdById: actorId, createdByName: actorName,
      },
    });
    created.push({ code, platform: p });
  }
  return created;
}

// Yangi vakansiya + havola(lar)
export async function createVacancyLink(fd: FormData): Promise<FormState> {
  const s = await requireSession();
  if (!can(s.role)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission" }) };

  const title = String(fd.get("title") || "").trim();
  if (title.length < 2) return { error: tr(s.locale, { uz: "Vakansiya nomi kamida 2 ta belgi bo'lsin", ru: "Название вакансии — минимум 2 символа", en: "Vacancy title must be at least 2 characters" }) };
  const platforms = parsePlatforms(fd);

  const vacancy = await prisma.vacancy.create({
    data: {
      title,
      company: String(fd.get("company") || "").trim() || null,
      country: String(fd.get("country") || "").trim() || null,
      countryCode: String(fd.get("countryCode") || "").trim() || null,
      jobTitle: String(fd.get("jobTitle") || "").trim() || null,
      salary: String(fd.get("salary") || "").trim() || null,
      description: String(fd.get("description") || "").trim() || null,
      // Ariza formasidagi qo'shimcha savollar (JSON) — mijozdan kelgani tozalab saqlanadi
      questions: serializeQuestions(parseQuestions(String(fd.get("questions") || ""))),
      branchId: s.branchId,
      createdById: s.userId,
      createdByName: s.fullName ?? null,
    },
  });
  const links = await createLinks(vacancy.id, platforms, fd, s.fullName ?? "", s.userId);
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "Vacancy", entityId: vacancy.id, newValue: { title, links: links.length } });
  revalidatePath("/links");
  return { ok: true, links };
}

// Mavjud vakansiyaga havola(lar) qo'shish
export async function addLinkToVacancy(fd: FormData): Promise<FormState> {
  const s = await requireSession();
  if (!can(s.role)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission" }) };
  const vacancyId = String(fd.get("vacancyId") || "");
  const v = await prisma.vacancy.findUnique({ where: { id: vacancyId }, select: { id: true } });
  if (!v) return { error: tr(s.locale, { uz: "Vakansiya topilmadi", ru: "Вакансия не найдена", en: "Vacancy not found" }) };
  const platforms = parsePlatforms(fd);
  const links = await createLinks(vacancyId, platforms, fd, s.fullName ?? "", s.userId);
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "VacancyLink", entityId: vacancyId, newValue: { links: links.length } });
  revalidatePath("/links");
  return { ok: true, links };
}

export async function toggleLink(id: string): Promise<void> {
  const s = await requireSession();
  if (!can(s.role)) return;
  const cur = await prisma.vacancyLink.findUnique({ where: { id }, select: { isActive: true } });
  if (!cur) return;
  await prisma.vacancyLink.update({ where: { id }, data: { isActive: !cur.isActive } });
  revalidatePath("/links");
}

export async function regenerateCode(id: string): Promise<void> {
  const s = await requireSession();
  if (!can(s.role)) return;
  const code = await uniqueCode();
  await prisma.vacancyLink.update({ where: { id }, data: { code } });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "VacancyLink", entityId: id, newValue: { code } });
  revalidatePath("/links");
}

export async function updateLink(fd: FormData): Promise<FormState> {
  const s = await requireSession();
  if (!can(s.role)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission" }) };
  const id = String(fd.get("id") || "");
  await prisma.vacancyLink.update({
    where: { id },
    data: {
      name: String(fd.get("name") || "").trim() || null,
      platform: String(fd.get("platform") || "other"),
      utmSource: String(fd.get("utmSource") || "").trim() || null,
      utmMedium: String(fd.get("utmMedium") || "").trim() || null,
      utmCampaign: String(fd.get("utmCampaign") || "").trim() || null,
      expiresAt: parseExpiry(fd.get("expiresAt")),
      maxSubmissions: Number(fd.get("maxSubmissions")) > 0 ? Math.round(Number(fd.get("maxSubmissions"))) : null,
    },
  });
  revalidatePath("/links");
  return { ok: true };
}

export async function deleteLink(id: string): Promise<void> {
  const s = await requireSession();
  if (!can(s.role)) return;
  // Bog'liq lidlarni uzamiz (vacancyLinkId = null), keyin havolani o'chiramiz
  await prisma.lead.updateMany({ where: { vacancyLinkId: id }, data: { vacancyLinkId: null } });
  await prisma.vacancyLink.delete({ where: { id } }).catch(() => {});
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "VacancyLink", entityId: id });
  revalidatePath("/links");
}

export async function deleteVacancy(id: string): Promise<void> {
  const s = await requireSession();
  if (!can(s.role)) return;
  const links = await prisma.vacancyLink.findMany({ where: { vacancyId: id }, select: { id: true } });
  const ids = links.map((l) => l.id);
  if (ids.length) await prisma.lead.updateMany({ where: { vacancyLinkId: { in: ids } }, data: { vacancyLinkId: null } });
  await prisma.vacancy.delete({ where: { id } }).catch(() => {}); // links cascade
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "Vacancy", entityId: id });
  revalidatePath("/links");
}

// QR — apply URL ni to'liq manzil bilan data-URL (PNG) qilib qaytaradi
export async function linkQrDataUrl(code: string): Promise<{ url: string; qr: string } | { error: string }> {
  const s = await requireSession(); // istalgan tizimga kirgan foydalanuvchi QR ko'ra oladi
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  const url = `${proto}://${host}/apply/${code}`;
  try {
    const qr = await QRCode.toDataURL(url, { width: 512, margin: 1 });
    return { url, qr };
  } catch {
    return { error: tr(s.locale, { uz: "QR yaratib bo'lmadi", ru: "Не удалось создать QR", en: "Failed to generate QR" }) };
  }
}
