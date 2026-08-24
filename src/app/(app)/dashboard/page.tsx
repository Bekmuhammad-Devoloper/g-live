import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { ROLES, ROLE_LABELS, EDU_STATUS_LABELS, label, formatMoney, isRopPosition, type Locale } from "@/lib/constants";
import { branchViaStudent } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { PageHeader, StatCard, Card, Badge } from "../_components/ui";
import CeoDashboard from "./CeoDashboard";
import AdminDashboard from "./AdminDashboard";
import TeacherDashboard from "./TeacherDashboard";

export default async function DashboardPage() {
  const s = await requireSession();

  // MANAGER roli ikki xil xodim uchun ishlatiladi va ikkalasining ham
  // o'z boshqaruv paneli bor — menejer dashboard'i emas:
  //   • ROP (sotuv bo'limi boshlig'i) → /rop
  //   • operator                      → /operator
  if (s.role === ROLES.ROP) redirect("/rop");
  if (s.role === ROLES.OPERATOR) redirect("/operator");
  if (s.role === ROLES.MANAGER) {
    // Eski yozuvlar (rol hali ko'chirilmagan) — lavozim bo'yicha aniqlaymiz
    const me = await prisma.user.findUnique({ where: { id: s.userId }, select: { position: true } });
    redirect(isRopPosition(me?.position) ? "/rop" : "/operator");
  }

  const t = getT(s.locale);

  return (
    <>
      <PageHeader
        title={`${t("dash.welcome")}, ${s.fullName}!`}
        subtitle={`${t("dash.role")}: ${label(ROLE_LABELS, s.role, s.locale)}`}
      />
      {await roleContent({ role: s.role, userId: s.userId, branchId: s.branchId, locale: s.locale, t })}
    </>
  );
}

async function roleContent({
  role,
  userId,
  branchId,
  locale,
  t,
}: {
  role: string;
  userId: string;
  branchId: string | null;
  locale: Locale;
  t: (k: string) => string;
}) {
  // ── CEO (Direktor) / rahbariyat / menejer — status paneli ──
  if (role === ROLES.DIRECTOR || role === ROLES.DEPUTY_DIRECTOR || role === ROLES.MANAGER) {
    return <CeoDashboard locale={locale} />;
  }

  // ── Administrator — alohida texnik panel ──
  if (role === ROLES.ADMIN) {
    return <AdminDashboard locale={locale} />;
  }

  // ── Hisobchi — faqat moliyaviy ko'rsatkichlar ──
  if (role === ROLES.ACCOUNTANT) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const b = branchViaStudent({ branchId }); // faol filial o'quvchilarining to'lovlari
    const [monthAgg, todayAgg, debtAgg, recent] = await Promise.all([
      prisma.payment.aggregate({ _sum: { amount: true }, where: { AND: [{ status: "PAID", createdAt: { gte: monthStart } }, b] } }),
      prisma.payment.aggregate({ _sum: { amount: true }, _count: true, where: { AND: [{ status: "PAID", createdAt: { gte: dayStart } }, b] } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { AND: [{ status: "PENDING" }, b] } }),
      prisma.payment.findMany({ where: b, orderBy: { createdAt: "desc" }, take: 6, include: { student: { select: { fullName: true } } } }),
    ]);
    return (
      <>
        <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label={tr(locale, { uz: "Bugungi tushum", ru: "Сегодняшний доход", en: "Today's revenue" })} value={formatMoney(todayAgg._sum.amount ?? 0, locale)} hint={`${todayAgg._count} ${tr(locale, { uz: "ta to'lov", ru: "платежей", en: "payments" })}`} tone="green" icon="wallet" />
          <StatCard label={tr(locale, { uz: "Bu oy tushum", ru: "Доход за месяц", en: "This month's revenue" })} value={formatMoney(monthAgg._sum.amount ?? 0, locale)} tone="brand" icon="card" />
          <StatCard label={tr(locale, { uz: "Jami qarzdorlik", ru: "Общая задолженность", en: "Total debt" })} value={formatMoney(debtAgg._sum.amount ?? 0, locale)} tone="amber" icon="alert" />
        </div>
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">{tr(locale, { uz: "So'nggi to'lovlar", ru: "Последние платежи", en: "Recent payments" })}</h3>
            <Link href="/finance" className="text-xs font-medium text-brand-600 hover:underline">{tr(locale, { uz: "Moliya bo'limi →", ru: "Раздел финансов →", en: "Finance section →" })}</Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-400">{t("common.noData")}</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {recent.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <span className="text-slate-700">{p.student.fullName}</span>
                  <span className="flex items-center gap-2">
                    <Badge tone={p.status === "PAID" ? "green" : p.status === "PENDING" ? "amber" : "slate"}>{p.status}</Badge>
                    <span className="font-semibold text-slate-800">{formatMoney(p.amount, locale)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </>
    );
  }

  // ── O'qituvchi ──
  if (role === ROLES.TEACHER) {
    return <TeacherDashboard userId={userId} locale={locale} />;
  }

  // ── O'quvchi ──
  if (role === ROLES.STUDENT) {
    const student = await prisma.student.findUnique({
      where: { userId },
      include: {
        enrollments: { include: { group: true } },
        payments: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });
    if (!student) return <Card>{tr(locale, { uz: "Profil topilmadi.", ru: "Профиль не найден.", en: "Profile not found." })}</Card>;
    const paid = student.payments.filter((p) => p.status === "PAID").reduce((n, p) => n + p.amount, 0);
    return (
      <>
        <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label={tr(locale, { uz: "Joriy daraja", ru: "Текущий уровень", en: "Current level" })} value={student.currentLevel ?? "—"} tone="brand" icon="award" />
          <StatCard label={tr(locale, { uz: "Status", ru: "Статус", en: "Status" })} value={label(EDU_STATUS_LABELS, student.eduStatus, locale)} icon="check" />
          <StatCard label={tr(locale, { uz: "Guruhlar", ru: "Группы", en: "Groups" })} value={student.enrollments.length} icon="book" />
          <StatCard label={tr(locale, { uz: "To'langan", ru: "Оплачено", en: "Paid" })} value={formatMoney(paid, locale)} tone="green" icon="wallet" />
        </div>
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">{tr(locale, { uz: "Guruhlarim", ru: "Мои группы", en: "My groups" })}</h3>
          {student.enrollments.length === 0 ? (
            <p className="text-sm text-slate-400">{t("common.noData")}</p>
          ) : (
            <ul className="space-y-1 text-sm text-slate-600">
              {student.enrollments.map((e) => (
                <li key={e.id}>📚 {e.group.name} — {e.group.room}</li>
              ))}
            </ul>
          )}
        </Card>
      </>
    );
  }

  // ── Ota-ona ──
  if (role === ROLES.PARENT) {
    const parent = await prisma.parent.findUnique({
      where: { userId },
      include: { children: { include: { student: true } } },
    });
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {(parent?.children ?? []).map((c) => (
          <Card key={c.id}>
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-800">{c.student.fullName}</span>
              <Badge tone="brand">{c.student.currentLevel ?? "—"}</Badge>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {label(EDU_STATUS_LABELS, c.student.eduStatus, locale)} · {c.relation}
            </p>
          </Card>
        ))}
        {(!parent || parent.children.length === 0) && <Card>{tr(locale, { uz: "Bog'langan farzand yo'q.", ru: "Нет привязанных детей.", en: "No linked children." })}</Card>}
      </div>
    );
  }

  // ── Boshqa (zaxira) ──
  return (
    <Card>
      <p className="text-sm text-slate-600">{tr(locale, { uz: "Bosh sahifa.", ru: "Главная.", en: "Home." })}</p>
    </Card>
  );
}
