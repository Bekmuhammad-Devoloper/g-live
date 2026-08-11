import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES, CONTRACT_TEMPLATE_TYPE_LABELS, label } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import ContractTemplatesView, { type VTemplate } from "./ContractTemplatesView";

// Shartnoma — faqat rahbariyat
const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];

const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;

export default async function ContractPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Shartnomalar bo'limi rahbariyat uchun.", ru: "Раздел договоров для руководства.", en: "The contracts section is for management." })} />;
  }

  const templates = await prisma.contractTemplate.findMany({ orderBy: { createdAt: "desc" } });

  const vtemplates: VTemplate[] = templates.map((t) => ({
    id: t.id,
    title: t.title,
    type: t.type,
    typeLabel: label(CONTRACT_TEMPLATE_TYPE_LABELS, t.type, s.locale),
    createdAt: fmtDate(t.createdAt),
    isActive: t.isActive,
  }));

  return <ContractTemplatesView templates={vtemplates} canManage locale={s.locale} />;
}
