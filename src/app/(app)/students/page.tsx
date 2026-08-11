import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES, type Locale } from "@/lib/constants";
import { canWrite, MODULES } from "@/lib/rbac";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import { Icon } from "../_components/Icon";
import StudentsView, { type VStudent } from "./StudentsView";
import type { Prisma } from "@prisma/client";

// Hisobchi faqat ro'yxatni ko'radi va to'lov qabul qiladi — talaba yaratish/tahrirlash huquqi yo'q (CAN_CREATE'da yo'q)
const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER, ROLES.ADMIN, ROLES.TEACHER, ROLES.ACCOUNTANT];
const CAN_CREATE = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER, ROLES.ADMIN];

export default async function StudentsPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return (
      <Forbidden
        title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })}
        body={tr(s.locale, { uz: "Bu bo'lim xodimlar uchun.", ru: "Этот раздел для сотрудников.", en: "This section is for staff." })}
      />
    );
  }

  // O'qituvchi faqat o'z guruhlaridagi o'quvchilarni ko'radi
  let where: Prisma.StudentWhereInput = {};
  if (s.role === ROLES.TEACHER) {
    where = { enrollments: { some: { group: { teacherId: s.userId } } } };
  }

  const students = await prisma.student.findMany({
    where,
    orderBy: { fullName: "asc" },
    include: {
      branch: { select: { name: true } },
      enrollments: {
        include: {
          group: {
            include: {
              teacher: { select: { fullName: true } },
              program: { select: { name: true } },
            },
          },
        },
      },
      payments: { select: { amount: true, status: true, createdAt: true } },
    },
  });

  const uniq = (arr: (string | null | undefined)[]) =>
    Array.from(new Set(arr.filter((x): x is string => !!x)));

  const now = new Date();
  const curY = now.getFullYear(), curM = now.getMonth();

  const vstudents: VStudent[] = students.map((st) => {
    const paid = st.payments.filter((p) => p.status === "PAID");
    return {
      id: st.id,
      fullName: st.fullName,
      phone: st.phone,
      imageUrl: st.imageUrl,
      eduStatus: st.eduStatus,
      currentLevel: st.currentLevel,
      groups: st.enrollments.map((e) => ({ id: e.groupId, name: e.group.name })),
      teachers: uniq(st.enrollments.map((e) => e.group.teacher?.fullName)),
      courses: uniq(st.enrollments.map((e) => e.group.program?.name)),
      scheduleDates: st.enrollments
        .map((e) => e.group.startDate?.toISOString())
        .filter((x): x is string => !!x),
      balance: paid.reduce((n, p) => n + p.amount, 0),
      // Qarz = PENDING to'lovlar yig'indisi (/finance/debtors bilan bir xil mantiq)
      debt: st.payments.filter((p) => p.status === "PENDING").reduce((n, p) => n + p.amount, 0),
      // Shu oy kamida bitta PAID to'lov bo'lganmi (davomat/to'lov holati bo'limi bilan bir xil mantiq)
      paidThisMonth: paid.some((p) => p.createdAt.getFullYear() === curY && p.createdAt.getMonth() === curM),
      note: null,
      branchName: st.branch?.name ?? null,
    };
  });

  const courses = Array.from(new Set(vstudents.flatMap((st) => st.courses))).sort();

  // Litsenziya (obuna) muddati — .env dagi SUBSCRIPTION_UNTIL
  const until = process.env.SUBSCRIPTION_UNTIL ?? null;
  const daysLeft = until ? Math.ceil((new Date(until).getTime() - Date.now()) / 86400000) : null;

  return (
    <div className="space-y-4">
      {until && daysLeft !== null && <LicenseBanner until={until} daysLeft={daysLeft} locale={s.locale} />}
      <StudentsView
        students={vstudents}
        courses={courses}
        locale={s.locale}
        canCreate={CAN_CREATE.includes(s.role as never)}
        canPay={canWrite(s.role, MODULES.PAYMENTS)}
        currentUserName={s.fullName}
      />
    </div>
  );
}

// Yuqoridagi litsenziya banneri (Modme uslubida)
function LicenseBanner({ until, daysLeft, locale }: { until: string; daysLeft: number; locale: Locale }) {
  const d = new Date(until);
  const p = (n: number) => String(n).padStart(2, "0");
  const date = `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
  const soon = daysLeft <= 7;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
        soon
          ? "border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <div className="flex items-center gap-2.5 text-sm">
        <Icon name="calendar" className={soon ? "h-5 w-5 text-amber-600" : "h-5 w-5 text-slate-400"} />
        <span className="text-slate-600 dark:text-slate-300">
          {tr(locale, { uz: "Litsenziyaning platformaga amal qilish muddati:", ru: "Срок действия лицензии на платформу:", en: "Platform license valid until:" })}{" "}
          <span className="font-semibold text-slate-800 dark:text-slate-100">{date} — 23:59</span>
        </span>
        <span className={`font-semibold ${soon ? "text-amber-700 dark:text-amber-400" : "text-slate-400"}`}>
          {daysLeft > 0
            ? (soon
                ? tr(locale, { uz: `${daysLeft} kundan kam vaqt qoldi`, ru: `Осталось меньше ${daysLeft} дней`, en: `Less than ${daysLeft} days left` })
                : tr(locale, { uz: `${daysLeft} kun qoldi`, ru: `Осталось ${daysLeft} дней`, en: `${daysLeft} days left` }))
            : tr(locale, { uz: "Muddat tugagan", ru: "Срок истёк", en: "Expired" })}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/settings/billing" className="rounded-lg bg-slate-500 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-slate-600">
          {tr(locale, { uz: "Batafsil", ru: "Подробнее", en: "Details" })}
        </Link>
        <Link href="/settings/billing" className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-600">
          {tr(locale, { uz: "To'lash", ru: "Оплатить", en: "Pay" })}
        </Link>
      </div>
    </div>
  );
}
