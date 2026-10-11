import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import { tr } from "@/lib/tr";
import { branchViaStudent, branchWhere } from "@/lib/branchScope";
import { Forbidden } from "../../_components/ui";
import LicenseBanner from "../../_components/LicenseBanner";
import AllPaymentsView, { type VPayment } from "./AllPaymentsView";
import { canEditPayments } from "../../students/actions";
import { groupAtDate, monthRange } from "../_components/attribution";

// Yechib olishlar ham Payment jadvalida saqlanadi (REFUNDED) — ularning bekor qilinganlari bu ro'yxatga kirmaydi
const WITHDRAWAL_PURPOSE = "Yechib olish";

// "Barcha to'lovlar" — Moliya hisoboti: statistika + filtrlar + saralanadigan jadval.
// Ro'yxatda haqiqiy to'lovlar (PAID) va "O'chirilganlar" filtri uchun bekor qilinganlar (CANCELLED).
export default async function AllPaymentsPage() {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.PAYMENTS)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsatingiz yo'q.", ru: "У вас нет доступа к этому разделу.", en: "You do not have permission for this section.", de: "Sie haben keine Berechtigung für diesen Bereich." })} />;
  }

  const [rows, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: {
        AND: [
          branchViaStudent(s), // faol filial doirasida (to'lov o'quvchi orqali bog'lanadi)
          {
            OR: [
              { status: "PAID" },
              { status: "CANCELLED", OR: [{ purpose: null }, { purpose: { not: WITHDRAWAL_PURPOSE } }] },
            ],
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { fullName: true } },
        student: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            enrollments: {
              select: {
                joinedAt: true,
                leftAt: true,
                group: {
                  select: {
                    id: true,
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
    }),
    // Sof foyda uchun xarajatlar — xarajatlar sahifasi kabi filial doirasida
    prisma.expense.findMany({ where: branchWhere(s), select: { date: true, amount: true, method: true } }),
  ]);

  const payments: VPayment[] = rows.map((p) => {
    const g = groupAtDate(p.student.enrollments, p.createdAt);
    return {
      id: p.id,
      date: p.createdAt.toISOString(),
      createdAt: p.createdAt.toISOString(),
      studentId: p.student.id,
      student: p.student.fullName,
      phone: p.student.phone ?? "",
      groupId: g?.id ?? null,
      group: g?.name ?? null,
      course: g?.program?.name ?? null,
      teacher: g?.teacher?.fullName ?? null,
      method: p.method,
      amount: p.amount,
      note: p.note ?? null,
      promoCode: p.promoCode ?? null,
      discount: p.discount,
      author: p.author?.fullName ?? null,
      status: p.status,
      cancelReason: p.cancelReason ?? null,
    };
  });

  const uniq = (arr: (string | null)[]) => [...new Set(arr.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));
  const groupMap = new Map<string, string>();
  for (const p of payments) if (p.groupId && p.group) groupMap.set(p.groupId, p.group);
  const options = {
    groups: [...groupMap.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    courses: uniq(payments.map((p) => p.course)),
    teachers: uniq(payments.map((p) => p.teacher)),
    methods: uniq(payments.map((p) => p.method)),
    staff: uniq(payments.map((p) => p.author)),
  };

  const { from, to } = monthRange();

  return (
    <div>
      <LicenseBanner />
      <AllPaymentsView
        payments={payments}
        expenses={expenses.map((e) => ({ date: e.date.toISOString(), amount: e.amount, method: e.method }))}
        options={options}
        locale={s.locale}
        defaultFrom={from}
        defaultTo={to}
        canEdit={await canEditPayments(s.role)}
      />
    </div>
  );
}
