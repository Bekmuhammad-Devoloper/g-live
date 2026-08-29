import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { branchWhere } from "@/lib/branchScope";
import { Forbidden } from "../../_components/ui";
import LicenseBanner from "../../_components/LicenseBanner";
import AdminPerfView, { type AdminStudent } from "./AdminPerfView";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];

const p2 = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// Administratorlar samaradorligi — har administrator (lidni boshqargan menejer)
// bo'yicha talabalarning davr boshi / o'zgarishlar / davr oxiridagi holati (status kesimida).
export default async function AdminPerformancePage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu hisobot rahbariyat uchun.", ru: "Этот отчёт для руководства.", en: "This report is for management.", de: "Dieser Bericht ist für die Geschäftsleitung." })} />;
  }

  const students = await prisma.student.findMany({
    where: branchWhere(s), // faol filial doirasida
    select: {
      eduStatus: true,
      createdAt: true,
      lead: { select: { manager: { select: { fullName: true } } } },
    },
  });

  const rows: AdminStudent[] = students.map((st) => ({
    admin: st.lead?.manager?.fullName ?? tr(s.locale, { uz: "Belgilanmagan", ru: "Не указано", en: "Unassigned", de: "Nicht zugewiesen" }),
    status: st.eduStatus,
    createdAt: st.createdAt.toISOString(),
  }));

  const now = new Date();
  const defaultFrom = isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultTo = isoDay(now);

  return (
    <div>
      <LicenseBanner />
      <AdminPerfView rows={rows} defaultFrom={defaultFrom} defaultTo={defaultTo} locale={s.locale} />
    </div>
  );
}
