"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { parseQuestions } from "../../(app)/links/questions";
import { parseUzPhone } from "@/lib/phone";
import { getLevelCodes } from "@/lib/studyLevels";

export type ApplyState = { ok?: boolean; error?: string };

// Ochiq (login talab qilmaydigan) ariza yuborish — CRM ga real Lead yaratadi.
// `answers` — havolaga biriktirilgan qo'shimcha savollarga javoblar (tartibi savollar bilan bir xil).
export async function submitApplication(
  code: string,
  fullName: string,
  phone: string,
  answers: string[] = [],
  extra: { age?: string; level?: string } = {},
): Promise<ApplyState> {
  const link = await prisma.vacancyLink.findUnique({ where: { code }, include: { vacancy: true } });
  if (!link) return { error: "Havola topilmadi" };
  if (!link.isActive) return { error: "Havola faol emas" };
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return { error: "Havolaning muddati o'tgan" };
  if (link.maxSubmissions != null && link.submissions >= link.maxSubmissions) return { error: "Ariza chegarasi to'ldi" };

  const name = fullName.trim().slice(0, 120);
  if (name.length < 2) return { error: "Ismingizni kiriting" };
  // Raqam AYNAN 9 xonali O'zbekiston raqami bo'lishi shart. Ilgari faqat
  // "kamida 7 raqam" tekshirilardi — shu sabab uzun, soxta raqamlar ham
  // qabul qilinardi (masalan +99850551899825644545).
  const tel = parseUzPhone(phone);
  if (!tel) return { error: "Telefon raqamini to'g'ri kiriting: +998 XX XXX XX XX" };

  // Yosh — mantiqiy oraliqda bo'lsagina saqlanadi
  const ageRaw = parseInt(String(extra.age ?? ""), 10);
  const ageNum = Number.isFinite(ageRaw) && ageRaw >= 3 && ageRaw <= 99 ? ageRaw : null;
  // Daraja — faqat ro'yxatdagi qiymat
  const levels = await getLevelCodes();
  const levelStr = levels.includes(String(extra.level ?? "")) ? String(extra.level) : null;

  // Qo'shimcha savollar — majburiylari serverda ham tekshiriladi (mijozga ishonmaymiz)
  const questions = parseQuestions(link.vacancy.questions);
  const qa: string[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const a = String(answers[i] ?? "").trim().slice(0, 500);
    if (q.required && !a) return { error: `"${q.q}" — javob berilishi shart` };
    // Variantli savolda faqat ro'yxatdagi javob qabul qilinadi
    if (a && q.type === "choice" && q.options && !q.options.includes(a)) {
      return { error: `"${q.q}" — noto'g'ri variant` };
    }
    if (a) qa.push(`${q.q}: ${a}`);
  }

  await prisma.lead.create({
    data: {
      fullName: name,
      phone: tel,
      // Yosh va daraja — ariza formasida so'raladi (ixtiyoriy)
      age: ageNum,
      level: levelStr,
      source: link.platform,
      utmSource: link.utmSource,
      utmMedium: link.utmMedium,
      utmCampaign: link.utmCampaign,
      vacancyLinkId: link.id,
      branchId: link.vacancy.branchId,
      note: [
        `Kurs/vakansiya: ${link.vacancy.title}${link.vacancy.country ? " (" + link.vacancy.country + ")" : ""}`,
        ...qa, // savollarga javoblar — CRM'da lid izohida ko'rinadi
      ].join("\n"),
      stage: "NEW",
    },
  });
  await prisma.vacancyLink.update({
    where: { id: link.id },
    data: { submissions: { increment: 1 }, lastSubmissionAt: new Date() },
  });
  revalidatePath("/links");
  return { ok: true };
}
