"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { writeAudit } from "@/lib/audit";

export type VacState = { ok?: boolean; error?: string; id?: string };

const CAN = [ROLES.ROP, ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN];
const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function guard() {
  const s = await requireSession();
  const error = CAN.includes(s.role as never)
    ? null
    : tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission" });
  return { s, error };
}

function refresh() {
  revalidatePath("/vacancies");
  revalidatePath("/links");
}

// ─── Yaratish / tahrirlash (id bo'lsa — tahrir) ───
export async function saveVacancy(fd: FormData): Promise<VacState> {
  const { s, error } = await guard();
  if (error) return { error };

  const id = txt(fd, "id");
  const title = txt(fd, "title");
  if (title.length < 2) {
    return { error: tr(s.locale, { uz: "Vakansiya nomi kamida 2 ta belgi bo'lsin", ru: "Название вакансии — минимум 2 символа", en: "Vacancy title must be at least 2 characters" }) };
  }

  const data = {
    title,
    company: txt(fd, "company") || null,
    country: txt(fd, "country") || null,
    countryCode: txt(fd, "countryCode") || null,
    jobTitle: txt(fd, "jobTitle") || null,
    salary: txt(fd, "salary") || null,
    description: txt(fd, "description") || null,
    isActive: fd.get("isActive") !== "false",
  };

  if (id) {
    const cur = await prisma.vacancy.findUnique({ where: { id }, select: { id: true } });
    if (!cur) return { error: tr(s.locale, { uz: "Vakansiya topilmadi", ru: "Вакансия не найдена", en: "Vacancy not found" }) };
    await prisma.vacancy.update({ where: { id }, data });
    await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Vacancy", entityId: id, newValue: { title } });
    refresh();
    return { ok: true, id };
  }

  const v = await prisma.vacancy.create({
    data: { ...data, branchId: s.branchId, createdById: s.userId, createdByName: s.fullName ?? null },
    select: { id: true },
  });
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "Vacancy", entityId: v.id, newValue: { title } });
  refresh();
  return { ok: true, id: v.id };
}

// ─── Faol / nofaol ───
export async function toggleVacancy(id: string): Promise<void> {
  const { error } = await guard();
  if (error) return;
  const v = await prisma.vacancy.findUnique({ where: { id }, select: { isActive: true } });
  if (!v) return;
  await prisma.vacancy.update({ where: { id }, data: { isActive: !v.isActive } });
  refresh();
}

// ─── O'chirish (havolalari ham o'chadi — onDelete: Cascade) ───
export async function removeVacancy(id: string): Promise<VacState> {
  const { s, error } = await guard();
  if (error) return { error };
  const v = await prisma.vacancy.findUnique({ where: { id }, select: { title: true } });
  if (!v) return { error: tr(s.locale, { uz: "Vakansiya topilmadi", ru: "Вакансия не найдена", en: "Vacancy not found" }) };
  await prisma.vacancy.delete({ where: { id } });
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "Vacancy", entityId: id, oldValue: { title: v.title } });
  refresh();
  return { ok: true };
}
