import { prisma } from "@/lib/db";

// Telefon bo'yicha qidiruv — bazada raqamlar FORMATLANGAN saqlanadi ("+998 90 700 00 01"),
// Asterisk esa CALLERID'ni yopishtirilgan holda beradi ("998907000001"). Shu sabab oddiy
// `contains` ishlamaydi: bo'shliq/chiziqcha/+/qavslarni olib tashlab, oxirgi 9 xona bo'yicha
// solishtiramiz (SQLite REPLACE zanjiri). Telefoniya API'lari (known, route-lookup) shundan foydalanadi.

/** Oxirgi 9 xona (mahalliy raqam) yoki null (juda qisqa) */
export function last9(raw: string): string | null {
  const d = String(raw ?? "").replace(/\D/g, "").slice(-9);
  return d.length >= 7 ? d : null;
}

const NORM = (col: string) => `replace(replace(replace(replace(replace(${col},' ',''),'-',''),'+',''),'(',''),')','')`;

/** Shu raqamli lidlar — eng oxirgi yangilangani birinchi */
export async function leadIdsByPhone(digits: string, limit = 5): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "Lead" WHERE phone IS NOT NULL AND ${NORM("phone")} LIKE ? ORDER BY updatedAt DESC LIMIT ?`,
    `%${digits}`,
    limit,
  );
  return rows.map((r) => r.id);
}

/** Shu raqamli o'quvchi bormi (phone yoki phone2) */
export async function studentExistsByPhone(digits: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "Student" WHERE (phone IS NOT NULL AND ${NORM("phone")} LIKE ?) OR (phone2 IS NOT NULL AND ${NORM("phone2")} LIKE ?) LIMIT 1`,
    `%${digits}`,
    `%${digits}`,
  );
  return rows.length > 0;
}
