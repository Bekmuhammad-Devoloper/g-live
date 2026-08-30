import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { PORTAL_FEATURES, getPortalFlags } from "@/lib/portalFeatures";
import { PageHeader, Forbidden } from "../../_components/ui";
import PortalFeaturesView, { type FeatureRow } from "./PortalFeaturesView";

// O'quvchi portalidagi bo'limlarni yoqish/o'chirish — menejer va rahbariyat
const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.MANAGER];

export default async function PortalSettingsPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return (
      <Forbidden
        title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })}
        body={tr(s.locale, { uz: "Bu bo'lim menejer va rahbariyat uchun.", ru: "Этот раздел для менеджера и руководства.", en: "This section is for managers and management.", de: "Dieser Bereich ist für Manager und Leitung." })}
      />
    );
  }

  const flags = await getPortalFlags();
  const rows: FeatureRow[] = PORTAL_FEATURES.map((f) => ({
    key: f.key,
    path: f.path,
    icon: f.icon,
    label: f.label[s.locale] ?? f.label.uz,
    desc: f.desc[s.locale] ?? f.desc.uz,
    on: flags[f.key],
  }));

  return (
    <div>
      <PageHeader
        title={tr(s.locale, { uz: "O'quvchi portali", ru: "Портал ученика", en: "Student portal", de: "Schülerportal" })}
        subtitle={tr(s.locale, { uz: "Qaysi bo'limlar o'quvchilarga ochiq bo'lishini belgilang", ru: "Выберите, какие разделы доступны ученикам", en: "Choose which sections are available to students", de: "Wählen Sie, welche Bereiche für Schüler verfügbar sind" })}
      />
      <PortalFeaturesView rows={rows} locale={s.locale} />
    </div>
  );
}
