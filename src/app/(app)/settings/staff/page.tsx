import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES, ROLE_LABELS, label, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import StaffView, { type VStaff } from "./StaffView";

const ALLOWED = [ROLES.DIRECTOR, ROLES.ADMIN, ROLES.DEPUTY_DIRECTOR];
// Ro'yxatda ko'rinadigan rollar (eski MANAGER yozuvlari ham ko'rinsin)
const STAFF_ROLES = [ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN, ROLES.TEACHER];
// Yangi xodimga tanlash mumkin bo'lgan rollar — eski MANAGER berilmaydi
const ASSIGNABLE_ROLES = [ROLES.OPERATOR, ROLES.ROP, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN, ROLES.TEACHER, ROLES.ACCOUNTANT];

export default async function StaffSettingsPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Xodimlar bo'limi faqat rahbariyat uchun.", ru: "Раздел сотрудников доступен только руководству.", en: "The staff section is available only to management." })} />;
  }

  const users = await prisma.user.findMany({
    where: { role: { in: STAFF_ROLES }, isActive: true },
    orderBy: [{ createdAt: "asc" }],
    select: { id: true, fullName: true, role: true, position: true, phone: true },
  });

  const rows: VStaff[] = users.map((u) => ({
    id: u.id,
    shortId: u.id.slice(-7).toUpperCase(),
    fullName: u.fullName,
    role: u.role,
    roleLabel: label(ROLE_LABELS, u.role, s.locale as Locale),
    position: u.position,
    phone: u.phone,
  }));

  const roleOptions = ASSIGNABLE_ROLES.map((r) => ({ value: r, label: label(ROLE_LABELS, r, s.locale as Locale) }));

  return <StaffView locale={s.locale} rows={rows} roleOptions={roleOptions} currentUserId={s.userId} />;
}

export const dynamic = "force-dynamic";
