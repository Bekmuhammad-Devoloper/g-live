// Finance V2 ops — SQLite bazaga to'g'ridan-to'g'ri (Prisma orqali) xizmat
// so'rovlari. Faqat skriptlar/testlar uchun; ilova kodi ishlatmaydi.
//
// Serverda `sqlite3` CLI yo'q (Phase 0 audit) — hamma narsa @prisma/client
// bilan: VACUUM INTO, integrity_check, qator sonlari.

import { PrismaClient } from "@prisma/client";

/** `file:/abs/path.db` → PrismaClient (faqat shu baza) */
export function openSqlite(path: string): PrismaClient {
  return new PrismaClient({ datasourceUrl: `file:${path}`, log: ["error"] });
}

export async function journalMode(db: PrismaClient): Promise<string> {
  const rows = await db.$queryRawUnsafe<{ journal_mode: string }[]>("PRAGMA journal_mode");
  return rows[0]?.journal_mode ?? "unknown";
}

/** `ok` yoki xato ro'yxati (SQLite integrity_check) */
export async function integrityCheck(db: PrismaClient): Promise<{ ok: boolean; messages: string[] }> {
  const rows = await db.$queryRawUnsafe<{ integrity_check: string }[]>("PRAGMA integrity_check");
  const messages = rows.map((r) => r.integrity_check);
  return { ok: messages.length === 1 && messages[0] === "ok", messages };
}

/** Jadval bormi (sqlite_master) */
export async function tableExists(db: PrismaClient, name: string): Promise<boolean> {
  const rows = await db.$queryRawUnsafe<{ n: number | bigint }[]>(
    `SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = '${name.replace(/'/g, "''")}'`,
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

/** Foydalanuvchi jadvallari (Prisma ichki jadvallari ham kiradi — `_prisma_migrations`) */
export async function listTables(db: PrismaClient): Promise<string[]> {
  const rows = await db.$queryRawUnsafe<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return rows.map((r) => r.name);
}

/** Har jadval uchun qator soni */
export async function rowCounts(db: PrismaClient, tables?: string[]): Promise<Record<string, number>> {
  const names = tables ?? (await listTables(db));
  const out: Record<string, number> = {};
  for (const t of names) {
    const rows = await db.$queryRawUnsafe<{ n: number | bigint }[]>(`SELECT count(*) AS n FROM "${t.replace(/"/g, '""')}"`);
    out[t] = Number(rows[0]?.n ?? 0);
  }
  return out;
}

/**
 * Tranzaksion izchil nusxa: SQLite `VACUUM INTO` — ishlayotgan bazadan ham
 * xavfsiz (oddiy `cp` emas). Manzil oldindan MAVJUD BO'LMASLIGI kerak.
 */
export async function vacuumInto(db: PrismaClient, targetPath: string): Promise<void> {
  await db.$executeRawUnsafe(`VACUUM INTO '${targetPath.replace(/'/g, "''")}'`);
}

export interface MigrationRow {
  migration_name: string;
  finished_at: string | null;
  rolled_back_at: string | null;
}

/** `_prisma_migrations` holati; jadval bo'lmasa `null` (baza hali `db push` rejimida) */
export async function migrationState(db: PrismaClient): Promise<MigrationRow[] | null> {
  if (!(await tableExists(db, "_prisma_migrations"))) return null;
  return db.$queryRawUnsafe<MigrationRow[]>(
    "SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at",
  );
}
