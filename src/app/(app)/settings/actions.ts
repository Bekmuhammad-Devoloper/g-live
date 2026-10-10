"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { setSetting } from "@/lib/settings";
import { writeAudit } from "@/lib/audit";
import { RECEIPT_MODE_KEY, RECEIPT_MODES, type ReceiptMode } from "@/lib/receiptMode";
import { DEFAULT_FEE_KEY } from "@/lib/debt";
import { BRAND_KEYS } from "@/lib/brand";

// Umumiy sozlamalar bo'limining BAZAGA yoziladigan amallari.
// (Qolgan bo'limlar hozircha localStorage'da — ular faqat ko'rinish sozlamalari.)

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR];

export type SettingResult = { ok?: boolean; error?: string };

/** Chek yuklash majburiyligini saqlaydi (to'lov qabul qilish formasi shunga qaraydi). */
export async function saveReceiptMode(mode: string): Promise<SettingResult> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };
  if (!RECEIPT_MODES.includes(mode as ReceiptMode)) return { error: "invalid" };

  await setSetting(RECEIPT_MODE_KEY, mode);

  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "Setting",
    entityId: RECEIPT_MODE_KEY,
    newValue: { receiptMode: mode },
    reason: "Chek yuklash siyosati o'zgartirildi",
  });

  // To'lov qabul qilinadigan sahifalar yangi qoidani darhol olsin
  revalidatePath("/settings");
  revalidatePath("/students");
  revalidatePath("/payments");
  return { ok: true };
}

/**
 * Markazning umumiy oylik to'lovi (so'm). O'quvchi hech qaysi guruhda
 * bo'lmagan oylar uchun qarz shu summadan hisoblanadi (src/lib/debt.ts).
 * 0 — o'chirilgan (guruhsiz oylar hisoblanmaydi).
 */
export async function saveDefaultMonthlyFee(value: number): Promise<SettingResult> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) return { error: "invalid" };

  await setSetting(DEFAULT_FEE_KEY, String(n));
  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "Setting",
    entityId: DEFAULT_FEE_KEY,
    newValue: { defaultMonthlyFee: n },
    reason: "Markazning umumiy oylik to'lovi o'zgartirildi",
  });

  revalidatePath("/settings");
  revalidatePath("/students");
  revalidatePath("/finance/debtors");
  return { ok: true };
}

/** Logotip manzili: faqat ilova ichidagi yo'l (/uploads/..., /logo.png) yoki https havola. Bo'sh — standart. */
function cleanLogoUrl(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return "";
  if (s.length > 500) return null;
  // Bo'shliq, qo'shtirnoq, burchak qavslar va teskari slesh taqiqlanadi
  if (/[\s"'<>\\]/.test(s)) return null;
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  if (/^https:\/\/\S+$/i.test(s)) return s;
  return null;
}

/**
 * Markaz brendi — nomi, yorug' va qorong'i fon uchun logotiplar (Setting: brand.*).
 * Bo'sh qiymat saqlanadi: getBrand() u holda standart qiymatga (ORG_NAME / asosiy markaz) qaytadi.
 */
export async function saveBrand(input: { name: string; logo: string; logoDark: string }): Promise<SettingResult> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };

  const name = String(input?.name ?? "").replace(/\s+/g, " ").trim();
  if (name.length > 80) return { error: "name_too_long" };
  const logo = cleanLogoUrl(input?.logo);
  const logoDark = cleanLogoUrl(input?.logoDark);
  if (logo === null || logoDark === null) return { error: "invalid_logo" };

  await Promise.all([
    setSetting(BRAND_KEYS.name, name),
    setSetting(BRAND_KEYS.logo, logo),
    setSetting(BRAND_KEYS.logoDark, logoDark),
  ]);
  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "Setting",
    entityId: "brand",
    newValue: { name, logo, logoDark },
    reason: "Markaz brendi o'zgartirildi",
  });

  // Nom va logotip butun ilova (sidebar, kirish sahifasi, manifest) bo'ylab ishlatiladi
  revalidatePath("/", "layout");
  return { ok: true };
}
