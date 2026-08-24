import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import LicenseBanner from "../_components/LicenseBanner";
import GeneralSettings from "./GeneralSettings";
import { getSetting } from "@/lib/settings";
import { RECEIPT_MODE_KEY, parseReceiptMode } from "@/lib/receiptMode";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR];

// Umumiy sozlamalar — markaz nomi/telefoni, ish vaqti, logotip, asosiy rang va h.k.
// ?tab=... orqali kerakli bo'lim ochiladi (masalan /settings?tab=billing).
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Sozlamalar faqat direktor va administrator uchun.", ru: "Настройки доступны только директору и администратору.", en: "Settings are available only to the director and administrator." })} />;
  }

  const sp = await searchParams;
  const receiptMode = parseReceiptMode(await getSetting(RECEIPT_MODE_KEY));
  const [branch, allBranches] = await Promise.all([
    s.branchId
      ? prisma.branch.findUnique({ where: { id: s.branchId }, select: { name: true, phone: true } })
      : prisma.branch.findFirst({ orderBy: { name: "asc" }, select: { name: true, phone: true } }),
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true } }),
  ]);

  return (
    <div>
      <LicenseBanner />
      <GeneralSettings
        locale={s.locale}
        defaultName={branch?.name ?? "Germaniya Live"}
        defaultPhone={branch?.phone ?? ""}
        branches={allBranches.map((b) => b.name)}
        initialSection={sp.tab ?? "general"}
        receiptMode={receiptMode}
      />
    </div>
  );
}
