"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { parseUzPhone } from "@/lib/phone";
import { getStudyLevels, levelTitle } from "@/lib/studyLevels";
import { gradeLevelTest, LEVEL_TEST_LEVELS, LEVEL_TEST_QUESTIONS, type TestLevel } from "@/lib/levelTest";

export type LevelTestOutcome =
  | { ok: true; level: TestLevel | null; label: string; color: string | null; correct: number; total: number; perLevel: Record<TestLevel, { correct: number; total: number }> }
  | { ok: false; error: string };

/** Lidga ko'chirish mumkin bo'lgan bosqichlar — ishlov boshlanmagan yoki suhbatda */
const MOVABLE_STAGES = ["NEW", "IN_PROGRESS", "CONTACTED"];

/**
 * Ochiq (login talab qilmaydigan) test natijasini qabul qilish.
 * Baholash faqat serverda. Natija CRM'ga tushadi:
 *   - telefon bo'yicha lid bor → level yangilanadi, "test" faoliyati qo'shiladi,
 *     hali ishlov boshida bo'lsa "Daraja testi" (TEST) bosqichiga o'tadi;
 *   - lid yo'q → yangi lid (manba "Daraja testi", bosqich TEST).
 */
export async function submitLevelTest(
  fullName: string,
  phone: string,
  rawAnswers: Record<string, number>,
  extra: { age?: string } = {},
): Promise<LevelTestOutcome> {
  const name = String(fullName ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (name.length < 2) return { ok: false, error: "Ismingizni kiriting" };
  const tel = parseUzPhone(phone);
  if (!tel) return { ok: false, error: "Telefon raqamini to'g'ri kiriting: +998 XX XXX XX XX" };

  // Javoblar — faqat mavjud savol id'lari va variant oralig'idagilari
  const answers: Record<number, number | undefined> = {};
  for (const q of LEVEL_TEST_QUESTIONS) {
    const v = Number(rawAnswers?.[String(q.id)]);
    if (Number.isInteger(v) && v >= 0 && v < q.options.length) answers[q.id] = v;
  }
  if (Object.keys(answers).length < LEVEL_TEST_QUESTIONS.length) return { ok: false, error: "Barcha savollarga javob bering" };

  const r = gradeLevelTest(answers);

  const ageRaw = parseInt(String(extra.age ?? ""), 10);
  const ageNum = Number.isFinite(ageRaw) && ageRaw >= 3 && ageRaw <= 99 ? ageRaw : null;

  // Natija matni — CRM'dagi faoliyat va izoh uchun
  const breakdown = LEVEL_TEST_LEVELS.map((l) => `${l} ${r.perLevel[l].correct}/${r.perLevel[l].total}`).join(", ");
  const levelText = r.level ?? "A1 dan past";
  const summary = `Daraja testi: ${levelText} — ${r.correct}/${r.total} to'g'ri (${breakdown})`;

  // Katalogdagi daraja — lid.level faqat katalogda bor kod bilan to'ldiriladi
  const catalog = await getStudyLevels();
  const row = r.level ? catalog.find((l) => l.code.toUpperCase() === r.level) ?? null : null;
  const label = row ? `${row.code} — ${levelTitle(row, "uz")}` : r.level ?? "Boshlang'ich (A1 dan past)";

  // Telefon bo'yicha mavjud lid: to'liq formatda yoki faqat raqamlari bilan saqlangan
  const digits = tel.replace(/\D/g, "").slice(-9);
  const existing = await prisma.lead.findFirst({
    where: { OR: [{ phone: tel }, { phone: { contains: digits } }] },
    orderBy: { createdAt: "desc" },
    select: { id: true, stage: true },
  });

  if (existing) {
    await prisma.lead.update({
      where: { id: existing.id },
      data: {
        ...(row ? { level: row.code } : {}),
        ...(ageNum ? { age: ageNum } : {}),
        ...(MOVABLE_STAGES.includes(existing.stage) ? { stage: "TEST" } : {}),
        activities: { create: { type: "test", result: summary } },
      },
    });
  } else {
    await prisma.lead.create({
      data: {
        fullName: name,
        phone: tel,
        age: ageNum,
        level: row?.code ?? null,
        source: "Daraja testi",
        stage: "TEST",
        note: summary,
        activities: { create: { type: "test", result: summary } },
      },
    });
  }

  revalidatePath("/crm");
  return { ok: true, level: r.level, label, color: row?.color ?? null, correct: r.correct, total: r.total, perLevel: r.perLevel };
}
