import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import LicenseBanner from "../../_components/LicenseBanner";
import SmsSettings from "./SmsSettings";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];

// SMS sozlamalari (Auto-SMS) — hodisalar bo'yicha avtomatik SMS shablonlari.
export default async function SmsSettingsPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Sozlamalar rahbariyat uchun.", ru: "Настройки доступны руководству.", en: "Settings are available to management.", de: "Die Einstellungen stehen nur der Leitung zur Verfügung." })} />;
  }

  // (LC) o'zgaruvchisi uchun markaz nomi — foydalanuvchi filiali yoki ilova nomi
  const branch = s.branchId ? await prisma.branch.findUnique({ where: { id: s.branchId }, select: { name: true } }) : null;
  const centerName = branch?.name ?? "Germaniya Live";

  return (
    <div>
      <LicenseBanner />
      <SmsSettings locale={s.locale} centerName={centerName} />
    </div>
  );
}
