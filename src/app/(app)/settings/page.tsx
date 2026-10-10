import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import LicenseBanner from "../_components/LicenseBanner";
import GeneralSettings from "./GeneralSettings";
import { getSetting, getSettings } from "@/lib/settings";
import { getBrand, BRAND_KEYS } from "@/lib/brand";
import { RECEIPT_MODE_KEY, parseReceiptMode } from "@/lib/receiptMode";
import { getDefaultMonthlyFee } from "@/lib/debt";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR];

// Umumiy sozlamalar — markaz nomi/telefoni, ish vaqti, logotip, asosiy rang va h.k.
// ?tab=... orqali kerakli bo'lim ochiladi (masalan /settings?tab=billing).
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Sozlamalar faqat direktor va administrator uchun.", ru: "Настройки доступны только директору и администратору.", en: "Settings are available only to the director and administrator.", de: "Einstellungen stehen nur dem Direktor und dem Administrator zur Verfügung." })} />;
  }

  const sp = await searchParams;
  const receiptMode = parseReceiptMode(await getSetting(RECEIPT_MODE_KEY));
  const defaultFee = await getDefaultMonthlyFee(); // qarz hisobidagi umumiy oylik to'lov
  const [branch, allBranches, brand, brandRaw] = await Promise.all([
    s.branchId
      ? prisma.branch.findUnique({ where: { id: s.branchId }, select: { name: true, phone: true } })
      : prisma.branch.findFirst({ orderBy: { name: "asc" }, select: { name: true, phone: true } }),
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true } }),
    getBrand(),
    getSettings([BRAND_KEYS.name, BRAND_KEYS.logo, BRAND_KEYS.logoDark]),
  ]);
  // Brend maydonlari bo'sh bo'lganda getBrand() qaytaradigan standart qiymatlar (src/lib/brand.ts bilan mos)
  const brandDefaults = {
    name: process.env.ORG_NAME?.trim() || (brand.isMain ? "Germaniya Live" : "O'quv markazi"),
    logo: brand.isMain ? "/logo.png" : "",
    logoDark: brand.isMain ? "/logo-dark.png" : "",
  };

  return (
    <div>
      <LicenseBanner />
      <GeneralSettings
        locale={s.locale}
        defaultName={branch?.name ?? brand.name}
        defaultPhone={branch?.phone ?? ""}
        branches={allBranches.map((b) => b.name)}
        initialSection={sp.tab ?? "general"}
        receiptMode={receiptMode}
        defaultFee={defaultFee}
        brand={{
          initial: {
            name: brandRaw[BRAND_KEYS.name] ?? "",
            logo: brandRaw[BRAND_KEYS.logo] ?? "",
            logoDark: brandRaw[BRAND_KEYS.logoDark] ?? "",
          },
          defaults: brandDefaults,
          name: brand.name,
          logo: brand.logo,
          logoDark: brand.logoDark,
          isMain: brand.isMain,
        }}
      />
    </div>
  );
}
