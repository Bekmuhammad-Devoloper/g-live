import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import BranchesView, { type VBranch } from "./BranchesView";

// Administrator faqat o'z filialiga tayinlangan — filiallar ro'yxatini ko'ra/boshqara olmaydi
const CAN = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR];

export default async function BranchesPage() {
  const s = await requireSession();
  if (!CAN.includes(s.role as never)) return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim rahbariyat uchun.", ru: "Этот раздел для руководства.", en: "This section is for management.", de: "Dieser Bereich ist für die Leitung." })} />;

  const branches = await prisma.branch.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { users: true, groups: true } } },
  });
  const rows: VBranch[] = branches.map((b) => ({
    id: b.id, name: b.name, address: b.address ?? "", phone: b.phone ?? "",
    lat: b.lat, lng: b.lng, radius: b.radius, imageUrl: b.imageUrl ?? null,
    staff: b._count.users, groups: b._count.groups,
  }));

  return <BranchesView branches={rows} canManage={CAN.includes(s.role as never)} locale={s.locale} />;
}
