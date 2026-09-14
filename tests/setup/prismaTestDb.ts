import { copyFileSync, rmSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

import { TEMPLATE_DB, TMP_DIR } from "./paths";

export interface TestDb {
  prisma: PrismaClient;
  /** Bazani yopadi va faylni o'chiradi — `afterAll` da chaqiriladi */
  dispose: () => Promise<void>;
}

/**
 * Har test fayli uchun alohida SQLite baza: shablon nusxalanadi, unga ulangan
 * PrismaClient qaytariladi. Fayl nomi + jarayon id — parallel ishlaganda
 * to'qnashmaydi.
 */
export function createTestDb(name: string): TestDb {
  const file = path.join(TMP_DIR, `${name}-${process.pid}-${Date.now()}.db`);
  copyFileSync(TEMPLATE_DB, file);

  const prisma = new PrismaClient({ datasourceUrl: `file:${file}` });

  return {
    prisma,
    dispose: async () => {
      await prisma.$disconnect();
      for (const suffix of ["", "-journal", "-wal", "-shm"]) {
        rmSync(file + suffix, { force: true });
      }
    },
  };
}
