import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import { tr } from "@/lib/tr";
import { branchWhere } from "@/lib/branchScope";
import { computeDebts } from "@/lib/debt";
import { Forbidden } from "../../_components/ui";
import LicenseBanner from "../../_components/LicenseBanner";
import DebtorsView, { type VDebtor } from "./DebtorsView";

// "Qarzdorlar" — to'lanmagan (PENDING) to'lovi bor talabalar ro'yxati.
export default async function DebtorsPage() {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.PAYMENTS)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsatingiz yo'q.", ru: "У вас нет доступа к этому разделу.", en: "You do not have permission for this section.", de: "Sie haben keine Berechtigung für diesen Bereich." })} />;
  }

  // Qarz — o'quvchi guruhga qo'shilgan oydan boshlab hisoblanadi, ustiga qo'lda
  // kiritilgan (PENDING) qarz qo'shiladi (src/lib/debt.ts). Shu sabab ro'yxat
  // faol filialning BARCHA o'quvchilaridan tuziladi, keyin qarzi bo'lgani qoladi.
  const students = await prisma.student.findMany({
    where: branchWhere(s), // faol filial doirasida
    select: {
      id: true, fullName: true, phone: true, eduStatus: true,
      enrollments: {
        take: 1, orderBy: { joinedAt: "desc" },
        select: { group: { select: { name: true, program: { select: { name: true } } } } },
      },
    },
  });

  const ids = students.map((st) => st.id);
  let debtors: VDebtor[] = [];

  if (ids.length) {
    const [debts, openTasks, firstPending] = await Promise.all([
      computeDebts(ids),
      prisma.task.groupBy({ by: ["studentId"], where: { status: "OPEN", studentId: { in: ids } }, _count: { _all: true } }),
      prisma.payment.groupBy({
        by: ["studentId"],
        where: { status: "PENDING", studentId: { in: ids } },
        _min: { createdAt: true },
      }),
    ]);

    const taskIds = new Set(openTasks.map((t) => t.studentId));
    const dueById = new Map(firstPending.map((p) => [p.studentId, p._min.createdAt]));

    debtors = students.map((st) => {
      const d = debts.get(st.id);
      const g = st.enrollments[0]?.group ?? null;
      // Muddat: qo'lda kiritilgan eng eski qarz sanasi, bo'lmasa guruhga qo'shilgan sana
      const due = dueById.get(st.id) ?? d?.since ?? null;
      return {
        studentId: st.id,
        student: st.fullName,
        phone: st.phone ?? "",
        group: g?.name ?? null,
        course: g?.program?.name ?? null,
        debt: d?.debt ?? 0,
        due: due ? due.toISOString() : null,
        status: st.eduStatus,
        hasTask: taskIds.has(st.id),
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
