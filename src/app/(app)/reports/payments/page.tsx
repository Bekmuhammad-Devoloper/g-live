import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { branchWhere, branchViaStudent } from "@/lib/branchScope";
import { Forbidden } from "../../_components/ui";
import LicenseBanner from "../../_components/LicenseBanner";
import RevenueView, { type RPayment } from "./RevenueView";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER];

const p2 = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// Kirim chiqim (tushum) hisoboti — tushum rejasi: to'langan/kutilayotgan summalar.
export default async function RevenuePage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim moliya bo'limi uchun.", ru: "Этот раздел для финансового отдела.", en: "This section is for the finance department.", de: "Dieser Bereich ist für die Finanzabteilung." })} />;
  }

  const [payments, students] = await Promise.all([
    // faol filial doirasida (to'lov o'quvchi orqali bog'lanadi)
    prisma.payment.findMany({ where: { AND: [{ status: "PAID" }, branchViaStudent(s)] }, select: { amount: true, studentId: true, createdAt: true } }),
    prisma.student.findMany({ where: branchWhere(s), select: { id: true, eduStatus: true } }), // faol filial doirasida
  ]);

  const rpayments: RPayment[] = payments.map((p) => ({
    amount: p.amount,
    studentId: p.studentId,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <div>
      <LicenseBanner />
      <RevenueView payments={rpayments} students={students} locale={s.locale} defaultDate={isoDay(new Date())} />
    </div>
  );
}
