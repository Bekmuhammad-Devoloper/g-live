import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import GradingSettings from "./GradingSettings";

const ALLOWED = [ROLES.DIRECTOR, ROLES.ADMIN];

export default async function GradingSettingsPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Sozlamalar faqat direktor va administrator uchun.", ru: "Настройки доступны только директору и администратору.", en: "Settings are available only to the director and administrator." })} />;
  }

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(s.locale, { uz: "Baholash", ru: "Оценивание", en: "Grading" })}</h1>
      <GradingSettings locale={s.locale} />
    </div>
  );
}
