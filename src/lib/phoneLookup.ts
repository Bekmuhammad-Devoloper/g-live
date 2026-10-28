import { prisma } from "@/lib/db";

export function last9(raw: string): string | null {
  const d = String(raw ?? "").replace(/\D/g, "").slice(-9);
  return d.length >= 7 ? d : null;
}

const NORM = (col: string) => `replace(replace(replace(replace(replace(${col},' ',''),'-',''),'+',''),'(',''),')','')`;

export async function leadIdsByPhone(digits: string, limit = 5): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "Lead" WHERE phone IS NOT NULL AND ${NORM("phone")} LIKE ? ORDER BY updatedAt DESC LIMIT ?`,
    `%${digits}`,
    limit,
  );
  return rows.map((r) => r.id);
}

export async function studentExistsByPhone(digits: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "Student" WHERE (phone IS NOT NULL AND ${NORM("phone")} LIKE ?) OR (phone2 IS NOT NULL AND ${NORM("phone2")} LIKE ?) LIMIT 1`,
    `%${digits}`,
    `%${digits}`,
  );
  return rows.length > 0;
}
