import "server-only";
import { prisma } from "./db";
import { getStudyLevels } from "./studyLevels";

function rankOf(code: string | null | undefined, order: Map<string, number>): number | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  if (order.has(c)) return order.get(c)!;
  for (const [k, v] of order) if (c.startsWith(k)) return v;
  return null;
}

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
    if (a !== null && b <= a) return;

    const seen = await prisma.studentLevelUp.findFirst({
      where: { studentId, toCode: to },
      select: { id: true },
    });
    if (seen) return;

    await prisma.studentLevelUp.create({ data: { studentId, fromCode: from ?? null, toCode: to } });
  } catch {
  }
}
