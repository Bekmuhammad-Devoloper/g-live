import "server-only";
import { prisma } from "./db";
import { getStudyLevels } from "./studyLevels";

// Daraja ko'tarilishini yozib boradi — tanga shu yozuvlar bo'yicha beriladi.
// Faqat YUQORIGA siljish sanaladi: A1 -> A2 ha, A2 -> A1 yo'q. Guruh
// almashtirilganda darajasi tushib qolsa o'quvchi tanga yo'qotmaydi.

/** "A1.2" kabi bo'linmalarni katalogdagi darajaga moslaydi */
function rankOf(code: string | null | undefined, order: Map<string, number>): number | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  if (order.has(c)) return order.get(c)!;
  for (const [k, v] of order) if (c.startsWith(k)) return v;
  return null;
}

/**
 * Daraja o'zgarganda chaqiriladi. Ko'tarilish bo'lsa bitta yozuv qo'shadi.
 * Xatosi ilovani to'xtatmasligi kerak — shu sabab ichida ushlanadi.
 */
export async function recordLevelUp(
  studentId: string,
  from: string | null | undefined,
  to: string | null | undefined,
): Promise<void> {
  try {
    if (!to || from === to) return;

    const levels = await getStudyLevels();
    const order = new Map(levels.map((l, i) => [l.code.toUpperCase(), i]));

    const a = rankOf(from, order);
    const b = rankOf(to, order);
    if (b === null) return;
    if (a !== null && b <= a) return; // pasayish yoki o'sha daraja

    // Bir darajaga bir marta — guruh qayta biriktirilsa takror yozilmasin
    const seen = await prisma.studentLevelUp.findFirst({
      where: { studentId, toCode: to },
      select: { id: true },
    });
    if (seen) return;

    await prisma.studentLevelUp.create({ data: { studentId, fromCode: from ?? null, toCode: to } });
  } catch {
    // yozib bo'lmasa — jim o'tamiz, asosiy amal buzilmasin
  }
}
