import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, canWrite, MODULES } from "@/lib/rbac";
import { tr } from "@/lib/tr";
import { branchWhere, branchViaStudent } from "@/lib/branchScope";
import { Forbidden } from "../../_components/ui";
import LicenseBanner from "../../_components/LicenseBanner";
import WithdrawalsView, { type VWithdrawal } from "./WithdrawalsView";

const p2 = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// "Yechib olish" — pul qaytarishlar (REFUNDED) ro'yxati: statistika + filtrlar + jadval.
export default async function WithdrawalsPage() {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.PAYMENTS)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsatingiz yo'q.", ru: "У вас нет доступа к этому разделу.", en: "You do not have permission for this section.", de: "Sie haben keine Berechtigung für diesen Bereich." })} />;
  }

  const [rows, students] = await Promise.all([
    prisma.payment.findMany({
      where: { AND: [{ status: "REFUNDED" }, branchViaStudent(s)] }, // faol filial doirasida
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { fullName: true } },
        student: {
          select: {
            fullName: true,
            phone: true,
            enrollments: {
              take: 1,
              orderBy: { joinedAt: "desc" },
              select: { group: { select: { program: { select: { name: true } } } } },
            },
          },
        },
      },
    }),
    // Forma uchun o'quvchilar ro'yxati — faol filial doirasida
    prisma.student.findMany({ where: branchWhere(s), orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
  ]);

  const withdrawals: VWithdrawal[] = rows.map((p) => ({
    id: p.id,
    date: p.createdAt.toISOString(),
    student: p.student.fullName,
    phone: p.student.phone ?? "",
    course: p.student.enrollments[0]?.group?.program?.name ?? null,
    amount: p.amount,
    note: p.note ?? null,
    author: p.author?.fullName ?? null,
  }));

  const courses = [...new Set(withdrawals.map((w) => w.course).filter((x): x is string => !!x))].sort();

  const now = new Date();
  const from = iso(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));

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
