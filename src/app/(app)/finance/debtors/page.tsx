import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import { tr } from "@/lib/tr";
import { branchWhere, branchViaStudent } from "@/lib/branchScope";
import { Forbidden } from "../../_components/ui";
import LicenseBanner from "../../_components/LicenseBanner";
import DebtorsView, { type VDebtor } from "./DebtorsView";

// "Qarzdorlar" — to'lanmagan (PENDING) to'lovi bor talabalar ro'yxati.
export default async function DebtorsPage() {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.PAYMENTS)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsatingiz yo'q.", ru: "У вас нет доступа к этому разделу.", en: "You do not have permission for this section." })} />;
  }

  // Qarz = talabaning PENDING to'lovlari yig'indisi
  const grouped = await prisma.payment.groupBy({
    by: ["studentId"],
    where: { AND: [{ status: "PENDING" }, branchViaStudent(s)] }, // faol filial doirasida
    _sum: { amount: true },
    _min: { createdAt: true },
  });

  const ids = grouped.map((g) => g.studentId);
  let debtors: VDebtor[] = [];

  if (ids.length) {
    const [students, openTasks] = await Promise.all([
      prisma.student.findMany({
        where: { AND: [{ id: { in: ids } }, branchWhere(s)] }, // faol filial doirasida
        select: {
          id: true, fullName: true, phone: true, eduStatus: true,
          enrollments: {
            take: 1, orderBy: { joinedAt: "desc" },
            select: { group: { select: { name: true, program: { select: { name: true } } } } },
          },
        },
      }),
      prisma.task.groupBy({ by: ["studentId"], where: { status: "OPEN", studentId: { in: ids } }, _count: { _all: true } }),
    ]);

    const sumById = new Map(grouped.map((g) => [g.studentId, { debt: g._sum.amount ?? 0, due: g._min.createdAt }]));
    const taskIds = new Set(openTasks.map((t) => t.studentId));
    const smap = new Map(students.map((st) => [st.id, st]));

    debtors = ids.map((id) => {
      const st = smap.get(id);
      const info = sumById.get(id)!;
      const g = st?.enrollments[0]?.group ?? null;
      return {
        studentId: id,
        student: st?.fullName ?? "—",
        phone: st?.phone ?? "",
        group: g?.name ?? null,
        course: g?.program?.name ?? null,
        debt: info.debt,
        due: info.due ? info.due.toISOString() : null,
        status: st?.eduStatus ?? "WAITING",
        hasTask: taskIds.has(id),
      };
    }).filter((d) => d.debt > 0).sort((a, b) => b.debt - a.debt);
  }

  const groups = [...new Set(debtors.map((d) => d.group).filter((x): x is string => !!x))].sort();

  return (
    <div>
      <LicenseBanner />
      <DebtorsView debtors={debtors} groups={groups} locale={s.locale} />
    </div>
  );
}
