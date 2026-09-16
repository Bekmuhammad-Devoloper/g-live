"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { parseUzPhone } from "@/lib/phone";
import { getStudyLevels, levelTitle } from "@/lib/studyLevels";
import { gradeSet, isTestSetId, normalizeSetAnswers, LEVEL_NAMES, type TestLevel, type TestSetId } from "@/lib/levelTest";

export type LevelTestOutcome =
  | {
      ok: true;
      set: TestSetId;
      level: TestLevel;
      correct: number;
      total: number;
      pct: number;
      passed: boolean;
      /** Natijaviy daraja (o'tmasa — bittasi pastroq; A1 o'tmasa null) */
      resultLevel: TestLevel | null;
      nextLevel: TestLevel | null;
      /** Katalogdagi nom, masalan "A2 — Asosiy" */
      label: string;
      color: string | null;
    }
  | { ok: false; error: string };

/** Lidga ko'chirish mumkin bo'lgan bosqichlar — ishlov boshlanmagan yoki suhbatda */
const MOVABLE_STAGES = ["NEW", "IN_PROGRESS", "CONTACTED"];

/**
 * Ochiq (login talab qilmaydigan) test natijasini qabul qilish.
 * Mijoz to'plamni (A1.1, B2.2 ...) o'zi tanlagan — baholash faqat serverda.
 * Natija CRM'ga tushadi:
 *   - telefon bo'yicha lid bor → level yangilanadi, "test" faoliyati qo'shiladi,
 *     hali ishlov boshida bo'lsa "Daraja testi" (TEST) bosqichiga o'tadi;
 *   - lid yo'q → yangi lid (manba "Daraja testi", bosqich TEST).
 */
export async function submitLevelTest(
  fullName: string,
  phone: string,
  setId: string,
  rawAnswers: Record<string, number>,
  extra: { age?: string } = {},
): Promise<LevelTestOutcome> {
  const name = String(fullName ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (name.length < 2) return { ok: false, error: "Ismingizni kiriting" };
  const tel = parseUzPhone(phone);
  if (!tel) return { ok: false, error: "Telefon raqamini to'g'ri kiriting: +998 XX XXX XX XX" };
  if (!isTestSetId(setId)) return { ok: false, error: "Test topilmadi" };

  const answers = normalizeSetAnswers(setId, rawAnswers);
  if (!answers) return { ok: false, error: "Barcha savollarga javob bering" };

  const r = gradeSet(setId, answers);

  const ageRaw = parseInt(String(extra.age ?? ""), 10);
  const ageNum = Number.isFinite(ageRaw) && ageRaw >= 3 && ageRaw <= 99 ? ageRaw : null;

  // Natija matni — CRM'dagi faoliyat va izoh uchun
  const levelText = r.resultLevel ? `${r.resultLevel} (${LEVEL_NAMES[r.resultLevel]})` : "A1 dan past";
  const summary = `Daraja testi ${r.set}: ${r.correct}/${r.total} to'g'ri (${r.pct}%) — ${r.passed ? "o'tdi" : "o'tmadi"} → daraja: ${levelText}`;

  // Katalogdagi daraja — lid.level faqat katalogda bor kod bilan to'ldiriladi
  const catalog = await getStudyLevels();
  const row = r.resultLevel ? catalog.find((l) => l.code.toUpperCase() === r.resultLevel) ?? null : null;
  const label = row ? `${row.code} — ${levelTitle(row, "uz")}` : r.resultLevel ? `${r.resultLevel} — ${LEVEL_NAMES[r.resultLevel]}` : "Boshlang'ich (A1 dan past)";

  // Telefon bo'yicha mavjud lid: to'liq formatda yoki faqat raqamlari bilan saqlangan
  const digits = tel.replace(/\D/g, "").slice(-9);
  const existing = await prisma.lead.findFirst({
    where: { OR: [{ phone: tel }, { phone: { contains: digits } }] },
    orderBy: { createdAt: "desc" },
    select: { id: true, stage: true },
  });

  // Natija lidning o'zida ham saqlanadi — CRM kartasida darhol ko'rinsin
  const testFields = {
    testSet: r.set,
    testLevel: r.resultLevel ?? null,
    testPct: r.pct,
    testPassed: r.passed,
    testedAt: new Date(),
  };

  if (existing) {
    await prisma.lead.update({
      where: { id: existing.id },
      data: {
        ...(row ? { level: row.code } : {}),
        ...(ageNum ? { age: ageNum } : {}),
        ...(MOVABLE_STAGES.includes(existing.stage) ? { stage: "TEST" } : {}),
        ...testFields,
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
        ...testFields,
        activities: { create: { type: "test", result: summary } },
      },
    });
  }

  revalidatePath("/crm");
  return {
    ok: true,
    set: r.set,
    level: r.level,
    correct: r.correct,
    total: r.total,
    pct: r.pct,
    passed: r.passed,
    resultLevel: r.resultLevel,
    nextLevel: r.nextLevel,
    label,
    color: row?.color ?? null,
  };
}
