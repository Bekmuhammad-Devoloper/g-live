import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES, ROLE_LABELS, label } from "@/lib/constants";
import { staffBranchWhere } from "@/lib/branchScope";
import { roleForPosition } from "../users/positions";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import RolesView, { type VRole } from "./RolesView";

const CAN_VIEW = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];
const CAN_MANAGE = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR];

export default async function RolesPage() {
  const s = await requireSession();
  if (!CAN_VIEW.includes(s.role as never)) return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim rahbariyat uchun.", ru: "Этот раздел для руководства.", en: "This section is for management.", de: "Dieser Bereich ist für die Geschäftsleitung." })} />;

  const [roles, users] = await Promise.all([
    prisma.staffRole.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({ where: { AND: [{ isActive: true }, staffBranchWhere(s)] }, select: { position: true } }),
  ]);
  const norm = (x: string) => x.trim().toLowerCase();
  const staffByPosition = new Map<string, number>();
  for (const u of users) if (u.position) staffByPosition.set(norm(u.position), (staffByPosition.get(norm(u.position)) ?? 0) + 1);
  const rows: VRole[] = roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    department: r.department ?? "",
    permissions: r.permissions ? r.permissions.split(",").filter(Boolean) : [],
    bossOnly: r.bossOnly,
    staff: staffByPosition.get(norm(r.name)) ?? 0,
    systemRole: label(ROLE_LABELS, roleForPosition(r.name), s.locale),
  }));

  return <RolesView roles={rows} canManage={CAN_MANAGE.includes(s.role as never)} locale={s.locale} />;
}
