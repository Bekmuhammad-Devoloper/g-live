"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { parseQuestions } from "../../(app)/links/questions";

export type ApplyState = { ok?: boolean; error?: string };

// Ochiq (login talab qilmaydigan) ariza yuborish — CRM ga real Lead yaratadi.
// `answers` — havolaga biriktirilgan qo'shimcha savollarga javoblar (tartibi savollar bilan bir xil).
export async function submitApplication(code: string, fullName: string, phone: string, answers: string[] = []): Promise<ApplyState> {
  const link = await prisma.vacancyLink.findUnique({ where: { code }, include: { vacancy: true } });
  if (!link) return { error: "Havola topilmadi" };
  if (!link.isActive) return { error: "Havola faol emas" };
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return { error: "Havolaning muddati o'tgan" };
  if (link.maxSubmissions != null && link.submissions >= link.maxSubmissions) return { error: "Ariza chegarasi to'ldi" };

  const name = fullName.trim();
  const tel = phone.trim();
  if (name.length < 2) return { error: "Ismingizni kiriting" };
  if (tel.replace(/\D/g, "").length < 7) return { error: "Telefon raqamini to'g'ri kiriting" };

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
