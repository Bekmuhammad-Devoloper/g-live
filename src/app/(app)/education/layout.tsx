import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { PageHeader, Forbidden } from "../_components/ui";
import EducationTabs, { type EduTab } from "./_components/EducationTabs";

// O'quv bo'limini ko'ra oladigan rollar (nav.ts dagi kabi: rahbariyat + o'qituvchi)
const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.TEACHER];
// Faqat rahbariyat ko'radigan bo'limlar (shartnoma)
const HEAD = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];

export default async function EducationLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim o'quv bo'limi uchun.", ru: "Этот раздел для учебного отдела.", en: "This section is for the education department." })} />;
  }

  const isHead = HEAD.includes(s.role as never);

  const tabs: EduTab[] = [
    { href: "/education", label: tr(s.locale, { uz: "Umumiy", ru: "Общее", en: "Overview" }), icon: "grid", exact: true },
    { href: "/education/online", label: tr(s.locale, { uz: "Onlayn kurslar", ru: "Онлайн-курсы", en: "Online courses" }), icon: "video" },
    { href: "/education/offline", label: tr(s.locale, { uz: "Offline kurslar", ru: "Офлайн-курсы", en: "Offline courses" }), icon: "building" },
    { href: "/education/assessment", label: tr(s.locale, { uz: "Mavsumiy baholash", ru: "Сезонное оценивание", en: "Seasonal assessment" }), icon: "filecheck" },
    ...(isHead ? [{ href: "/education/contract", label: tr(s.locale, { uz: "Shartnoma", ru: "Договор", en: "Contract" }), icon: "clipboard" }] : []),
  ];

  return (
    <div>
      <PageHeader title={tr(s.locale, { uz: "O'quv bo'limi", ru: "Учебный отдел", en: "Education department" })} subtitle={tr(s.locale, { uz: "Kurslar, mavsumiy baholash va shartnomalar", ru: "Курсы, сезонное оценивание и договоры", en: "Courses, seasonal assessment and contracts" })} />
      <EducationTabs tabs={tabs} />
      {children}
    </div>
  );
}
