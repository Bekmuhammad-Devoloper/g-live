import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import BalanceView, { type VBalanceStaff } from "./BalanceView";

const STAFF_ROLES = [ROLES.TEACHER, ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN];
const p2 = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

export default async function BalancePage() {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.REPORTS)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsat yo'q.", ru: "Нет доступа к этому разделу.", en: "You don't have access to this section." })} />;
  }

  const users = await prisma.user.findMany({
    where: { role: { in: STAFF_ROLES }, isActive: true },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, phone: true, fiksa: true, salaries: { select: { year: true, month: true, bonus: true, penalty: true } } },
  });

  const staff: VBalanceStaff[] = users.map((u) => ({
    id: u.id, name: u.fullName, phone: u.phone, fiksa: u.fiksa,
    records: u.salaries.map((r) => ({ y: r.year, m: r.month, bonus: r.bonus, penalty: r.penalty })),
  }));

  const now = new Date();
  const from = iso(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  return <BalanceView staff={staff} defaultFrom={from} defaultTo={to} locale={s.locale} />;
}
