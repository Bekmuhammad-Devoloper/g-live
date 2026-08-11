// Umumiy tizim sozlamalari (key-value) uchun server yordamchilari.
// Faqat serverda ishlatiladi (prisma). "Setting" modeli — key @id.

import { prisma } from "./db";

export async function getSetting(key: string): Promise<string | null> {
  const r = await prisma.setting.findUnique({ where: { key } });
  return r?.value ?? null;
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}
