import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import { tr } from "@/lib/tr";
import { branchViaStudent } from "@/lib/branchScope";
import { Forbidden } from "../../_components/ui";
import LicenseBanner from "../../_components/LicenseBanner";
import { groupAtDate, monthRange } from "../_components/attribution";
import CoursePaymentsView, { type VCourseRow } from "./CoursePaymentsView";

// "Kurslar bo'yicha to'lovlar" — davr ichidagi PAID to'lovlar kurslar (Program) kesimida.
// Kurs o'quvchining to'lov sanasidagi guruhi orqali aniqlanadi.
export default async function PaymentsByCoursesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.PAYMENTS)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsatingiz yo'q.", ru: "У вас нет доступа к этому разделу.", en: "You do not have permission for this section.", de: "Sie haben keine Berechtigung für diesen Bereich." })} />;
  }

  const sp = await searchParams;
  const { from, to, gte, lte } = monthRange(sp.from, sp.to);

  const rows = await prisma.payment.findMany({
    where: { AND: [{ status: "PAID", createdAt: { gte, lte } }, branchViaStudent(s)] },
    select: {
      amount: true,
      createdAt: true,
      student: {
        select: {
          enrollments: {
            select: {
              joinedAt: true,
              leftAt: true,
              group: { select: { program: { select: { id: true, name: true } } } },
            },
          },
        },
      },
    },
  });

  const map = new Map<string, VCourseRow>();
  let total = 0;
  for (const p of rows) {
    total += p.amount;
    const prog = groupAtDate(p.student.enrollments, p.createdAt)?.program ?? null;
    const key = prog?.id ?? "";
    const r = map.get(key) ?? { courseId: prog?.id ?? null, name: prog?.name ?? null, amount: 0 };
    r.amount += p.amount;
    map.set(key, r);
  }
  const courses = [...map.values()].sort((a, b) => b.amount - a.amount);

  return (
    <div>
      <LicenseBanner />
      <CoursePaymentsView key={`${from}_${to}`} rows={courses} total={total} from={from} to={to} locale={s.locale} />
    </div>
  );
}
