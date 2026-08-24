import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { branchViaStudent } from "@/lib/branchScope";
import { Forbidden } from "../../_components/ui";
import LicenseBanner from "../../_components/LicenseBanner";
import CancelledView, { type VCancel } from "./CancelledView";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER];

// Bekor qilingan to'lovlar — status = CANCELLED bo'lgan to'lovlar ro'yxati.
export default async function CancelledPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim moliya bo'limi uchun.", ru: "Этот раздел для финансового отдела.", en: "This section is for the finance department." })} />;
  }

  const pays = await prisma.payment.findMany({
    where: { AND: [{ status: "CANCELLED" }, branchViaStudent(s)] }, // faol filial doirasida
    orderBy: { cancelledAt: "desc" },
    select: {
      id: true,
      amount: true,
      cancelReason: true,
      cancelledAt: true,
      studentId: true,
      student: {
        select: {
          fullName: true,
          enrollments: {
            take: 1,
            orderBy: { joinedAt: "desc" },
            select: { group: { select: { name: true, teacher: { select: { fullName: true } } } } },
          },
        },
      },
    },
  });

  // Har bir o'quvchi bo'yicha jami bekor qilingan summa
  const totalByStudent = new Map<string, number>();
  for (const p of pays) totalByStudent.set(p.studentId, (totalByStudent.get(p.studentId) ?? 0) + p.amount);

  const rows: VCancel[] = pays.map((p) => {
    const enr = p.student.enrollments[0];
    return {
      id: p.id,
      studentName: p.student.fullName,
      amount: p.amount,
      totalCancelled: totalByStudent.get(p.studentId) ?? p.amount,
      teacher: enr?.group.teacher?.fullName ?? null,
      group: enr?.group.name ?? null,
      reason: p.cancelReason,
      cancelledAt: p.cancelledAt ? p.cancelledAt.toISOString() : null,
    };
  });

  return (
    <div>
      <LicenseBanner />
      <CancelledView rows={rows} locale={s.locale} />
    </div>
  );
}
