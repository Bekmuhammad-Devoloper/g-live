import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { canRead, MODULES } from "@/lib/rbac";
import { ROLES, ROLE_LABELS, label } from "@/lib/constants";
import { Forbidden } from "../_components/ui";
import UsersView, { type VStaff } from "./UsersView";

const STAFF_ROLES = [ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN, ROLES.TEACHER];
const CAN_MANAGE = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];

export default async function UsersPage() {
  const s = await requireSession();
  const t = getT(s.locale);
  if (!canRead(s.role, MODULES.USERS)) {
    return <Forbidden title={t("err.forbidden")} body={t("err.forbiddenBody")} />;
  }

  const users = await prisma.user.findMany({
    where: { role: { in: STAFF_ROLES } },
    orderBy: { createdAt: "asc" },
    include: {
      branch: { select: { name: true } },
      teacherGroups: { include: { program: { select: { name: true } }, _count: { select: { students: true } } } },
    },
  });

  const staff: VStaff[] = users.map((u) => ({
    id: u.id,
    name: u.fullName,
    gender: u.gender,
    students: u.teacherGroups.reduce((n, g) => n + g._count.students, 0),
    groups: u.teacherGroups.map((g) => ({ id: g.id, name: g.name })),
    role: u.role,
    // Lavozim (katalog roli) bo'lsa shuni ko'rsatamiz, bo'lmasa RBAC rol nomi
    roleLabel: u.position?.trim() || label(ROLE_LABELS, u.role, s.locale),
    branch: u.branch?.name ?? null,
    phone: u.phone,
    courses: Array.from(new Set(u.teacherGroups.map((g) => g.program?.name).filter((x): x is string => !!x))),
    active: u.isActive,
  }));

  // "O'quv markazidagi vazifasi" — Rollar katalogidan (bo'lim bo'yicha guruhlanadi)
  const catalog = await prisma.staffRole.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { name: true, department: true } });
  const positions = catalog.map((r) => ({ value: r.name, label: r.name, department: r.department ?? "" }));

  const branches = await prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  return <UsersView staff={staff} positions={positions} branches={branches} canManage={CAN_MANAGE.includes(s.role as never)} locale={s.locale} />;
}
