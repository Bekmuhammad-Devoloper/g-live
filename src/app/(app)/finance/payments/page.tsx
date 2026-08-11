import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import LicenseBanner from "../../_components/LicenseBanner";
import AllPaymentsView, { type VPayment } from "./AllPaymentsView";

const p2 = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// "Barcha to'lovlar" — Moliya hisoboti: statistika + filtrlar + saralanadigan jadval.
export default async function AllPaymentsPage() {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.PAYMENTS)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsatingiz yo'q.", ru: "У вас нет доступа к этому разделу.", en: "You do not have permission for this section." })} />;
  }

  const rows = await prisma.payment.findMany({
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
            select: {
              group: {
                select: {
                  name: true,
                  teacher: { select: { fullName: true } },
                  program: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const payments: VPayment[] = rows.map((p) => {
    const g = p.student.enrollments[0]?.group ?? null;
    return {
      id: p.id,
      date: p.createdAt.toISOString(),
      student: p.student.fullName,
      phone: p.student.phone ?? "",
      group: g?.name ?? null,
      course: g?.program?.name ?? null,
      teacher: g?.teacher?.fullName ?? null,
      method: p.method,
      amount: p.amount,
      note: p.note ?? null,
      author: p.author?.fullName ?? null,
      status: p.status,
    };
  });

  const uniq = (arr: (string | null)[]) => [...new Set(arr.filter((x): x is string => !!x))].sort();
  const options = {
    groups: uniq(payments.map((p) => p.group)),
    courses: uniq(payments.map((p) => p.course)),
    teachers: uniq(payments.map((p) => p.teacher)),
    methods: uniq(payments.map((p) => p.method)),
    staff: uniq(payments.map((p) => p.author)),
  };

  const now = new Date();
  const from = iso(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  return (
    <div>
      <LicenseBanner />
      <AllPaymentsView payments={payments} options={options} locale={s.locale} defaultFrom={from} defaultTo={to} />
    </div>
  );
}
