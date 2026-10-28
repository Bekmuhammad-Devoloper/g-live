import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, canWrite, MODULES } from "@/lib/rbac";
import { tr } from "@/lib/tr";
import { branchWhere, branchViaStudent } from "@/lib/branchScope";
import { Forbidden } from "../../_components/ui";
import LicenseBanner from "../../_components/LicenseBanner";
import WithdrawalsView, { type VWithdrawal } from "./WithdrawalsView";
import { groupAtDate, monthRange } from "../_components/attribution";

export default async function WithdrawalsPage() {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.PAYMENTS)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsatingiz yo'q.", ru: "У вас нет доступа к этому разделу.", en: "You do not have permission for this section.", de: "Sie haben keine Berechtigung für diesen Bereich." })} />;
  }

  const [rows, students] = await Promise.all([
    prisma.payment.findMany({
      where: { AND: [{ status: "REFUNDED" }, branchViaStudent(s)] },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { fullName: true } },
        student: {
          select: {
            fullName: true,
            phone: true,
            id: true,
            enrollments: {
              select: { joinedAt: true, leftAt: true, group: { select: { id: true, name: true, program: { select: { name: true } } } } },
            },
          },
        },
      },
    }),
    prisma.student.findMany({ where: branchWhere(s), orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
  ]);

  const withdrawals: VWithdrawal[] = rows.map((p) => {
    const g = groupAtDate(p.student.enrollments, p.createdAt);
    return {
      id: p.id,
      date: p.createdAt.toISOString(),
      studentId: p.student.id,
      student: p.student.fullName,
      phone: p.student.phone ?? "",
      groupId: g?.id ?? null,
      group: g?.name ?? null,
      course: g?.program?.name ?? null,
      amount: p.amount,
      note: p.note ?? null,
      author: p.author?.fullName ?? null,
    };
  });

  const courses = [...new Set(withdrawals.map((w) => w.course).filter((x): x is string => !!x))].sort();

  const { from, to } = monthRange();

  return (
    <div>
      <LicenseBanner />
      <WithdrawalsView
        withdrawals={withdrawals}
        courses={courses}
        students={students}
        writable={canWrite(s.role, MODULES.PAYMENTS)}
        locale={s.locale}
        defaultFrom={from}
        defaultTo={to}
      />
    </div>
  );
}
