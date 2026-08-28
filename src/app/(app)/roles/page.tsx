import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import RolesView, { type VRole } from "./RolesView";

// Sahifani ko'rish — rahbariyat va administrator
const CAN_VIEW = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];
// Rol qo'shish/tahrirlash/o'chirish — FAQAT direktor va o'rinbosari
// (2026-08-28 talab: administratorda bu funksiya bo'lmasin)
const CAN_MANAGE = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR];

export default async function RolesPage() {
  const s = await requireSession();
  if (!CAN_VIEW.includes(s.role as never)) return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim rahbariyat uchun.", ru: "Этот раздел для руководства.", en: "This section is for management." })} />;

  const roles = await prisma.staffRole.findMany({ orderBy: { createdAt: "asc" } });
  const rows: VRole[] = roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    department: r.department ?? "",
    permissions: r.permissions ? r.permissions.split(",").filter(Boolean) : [],
    bossOnly: r.bossOnly,
    staff: 0,
  }));

  return <RolesView roles={rows} canManage={CAN_MANAGE.includes(s.role as never)} locale={s.locale} />;
}
