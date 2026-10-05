import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { canRead, MODULES } from "@/lib/rbac";
import { ROLES, ROLE_LABELS, label } from "@/lib/constants";
import { branchWhere, staffBranchWhere } from "@/lib/branchScope";
import { Forbidden } from "../_components/ui";
import UsersView, { type VStaff } from "./UsersView";
import { MANAGEMENT_DEPT, MANAGEMENT_POSITIONS } from "./positions";

const STAFF_ROLES = [ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN, ROLES.TEACHER];
const CAN_MANAGE = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];

export default async function UsersPage() {
  const s = await requireSession();
  const t = getT(s.locale);
  if (!canRead(s.role, MODULES.USERS)) {
    return <Forbidden title={t("err.forbidden")} body={t("err.forbiddenBody")} />;
  }

  // XAVFSIZLIK: `select` — passwordHash/plainPassword hech qachon xotiraga ham yuklanmaydi
  const users = await prisma.user.findMany({
    where: { AND: [{ role: { in: STAFF_ROLES } }, staffBranchWhere(s)] }, // faol filial doirasida (qo'shimcha filiallar ham)
    orderBy: { createdAt: "asc" },
    select: {
      id: true, fullName: true, gender: true, role: true, position: true, phone: true, isActive: true,
      branch: { select: { name: true } },
      branches: { select: { branch: { select: { name: true } } } },
      teacherGroups: {
        where: branchWhere(s), // faol filial doirasida
        select: { id: true, name: true, program: { select: { name: true } }, _count: { select: { students: true } } },
      },
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
    // Asosiy + qo'shimcha filiallar
    branch: [u.branch?.name, ...u.branches.map((b) => b.branch.name)].filter(Boolean).join(" · ") || null,
    phone: u.phone,
    courses: Array.from(new Set(u.teacherGroups.map((g) => g.program?.name).filter((x): x is string => !!x))),
    active: u.isActive,
  }));

  // "O'quv markazidagi vazifasi" — Rollar katalogidan (bo'lim bo'yicha guruhlanadi)
  const catalog = await prisma.staffRole.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { name: true, department: true } });
  // Rahbariyat lavozimlari (Direktor, o'rinbosar) faqat direktorga ko'rinadi va katalogdan
  // o'chirilgan bo'lsa ham tanlovda turadi — aks holda direktorni tahrirlab bo'lmaydi.
  const isDirector = s.role === ROLES.DIRECTOR;
  const fromCatalog = catalog
    .filter((r) => isDirector || r.department !== MANAGEMENT_DEPT)
    .map((r) => ({ value: r.name, label: r.name, department: r.department ?? "" }));
  const missingMgmt = isDirector
    ? MANAGEMENT_POSITIONS.filter((n) => !fromCatalog.some((p) => p.value.trim().toLowerCase() === n.toLowerCase()))
        .map((n) => ({ value: n as string, label: n as string, department: MANAGEMENT_DEPT }))
    : [];
  const positions = [...missingMgmt, ...fromCatalog];

  const branches = await prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  return <UsersView staff={staff} positions={positions} branches={branches} canManage={CAN_MANAGE.includes(s.role as never)} canDelete={s.role === ROLES.DIRECTOR} locale={s.locale} />;
}
