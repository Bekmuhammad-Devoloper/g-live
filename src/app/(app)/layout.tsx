import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { navFor } from "@/lib/nav";
import { getT } from "@/lib/i18n";
import { ROLES, ROLE_LABELS, label, isRopPosition } from "@/lib/constants";
import { canWrite, MODULES } from "@/lib/rbac";
import AppShell from "./_components/AppShell";
import Softphone from "./_components/Softphone";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  // Diqqat: STUDENT bu yerdan redirect QILINMAYDI — /checkin/[token] (QR-davomat)
  // shu layout ichida va uni o'quvchining o'zi ochadi. Qolgan sahifalar har biri
  // o'z RBAC tekshiruvi bilan himoyalangan (canRead bo'lmasa Forbidden).

  const t = getT(session.locale);
  const isTeacher = session.role === ROLES.TEACHER;
  const canCreateStudent = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER, ROLES.ADMIN].includes(
    session.role as never
  );
  const canCreatePayment = canWrite(session.role, MODULES.PAYMENTS);
  // Administrator faqat o'z filialiga tayinlangan — filial almashtira/qo'sha olmaydi (TZ)
  const canSwitchBranch = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR].includes(session.role as never);
  // Telefoniya softphone — operator/ROP/admin rollari uchun
  // Telefoniya sozlamalarini faqat direktor va administrator o'zgartiradi
  const canConfigureTelephony = [ROLES.DIRECTOR, ROLES.ADMIN].includes(session.role as never);
  const canPhone = [ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN].includes(session.role as never);

  // O'z profil rasmi (topbar avatari uchun) + lavozim
  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { position: true, imageUrl: true },
  });

  // Sotuv bo'limi rollari o'z portaliga ega (eski loyihadagi kabi).
  // Eski MANAGER yozuvlari uchun lavozim bo'yicha zaxira aniqlash saqlanadi.
  const portal =
    session.role === ROLES.ROP ? "rop"
    : session.role === ROLES.OPERATOR ? "operator"
    : session.role === ROLES.MANAGER ? (isRopPosition(me?.position) ? "rop" : "operator")
    : undefined;

  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86400000);

  const [branch, unreadCount, branches, students, lessons, groups] = await Promise.all([
    session.branchId ? prisma.branch.findUnique({ where: { id: session.branchId } }) : Promise.resolve(null),
    prisma.notification.count({ where: { userId: session.userId, isRead: false } }),
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    canCreatePayment
      ? prisma.student.findMany({ select: { id: true, fullName: true }, orderBy: { fullName: "asc" }, take: 300 })
      : Promise.resolve([]),
    prisma.lesson.findMany({
      where: {
        startsAt: { gte: now, lte: weekAhead },
        ...(isTeacher ? { group: { teacherId: session.userId } } : {}),
      },
      orderBy: { startsAt: "asc" },
      take: 8,
      include: { group: { select: { id: true, name: true } } },
    }),
    // Yangi talabani darhol guruhga biriktirish uchun (navbar formasi)
    canCreateStudent
      ? prisma.group.findMany({
          where: { status: { in: ["ACTIVE", "PLANNED"] } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: 300,
        })
      : Promise.resolve([]),
  ]);

  const navItems = navFor(session.role).map((it) => ({
    href: it.href,
    icon: it.icon,
    label: t(it.i18nKey),
  }));

  return (
    <AppShell
      navItems={navItems}
      role={session.role}
      portal={portal}
      locale={session.locale}
      user={{
        fullName: session.fullName,
        role: session.role,
        imageUrl: me?.imageUrl ?? null,
        roleLabel: label(ROLE_LABELS, session.role, session.locale),
        branchName: branch?.name ?? null,
      }}
      labels={{
        logout: t("common.logout"),
        appName: t("app.name"),
        tagline: t("app.tagline"),
      }}
      unreadCount={unreadCount}
      topbar={{
        branches,
        currentBranchId: session.branchId,
        canSwitchBranch,
        canCreateStudent,
        canCreatePayment,
        students,
        groups,
        upcoming: lessons.map((l) => ({
          id: l.id,
          groupId: l.group.id,
          groupName: l.group.name,
          topic: l.topic,
          startsAt: l.startsAt.toISOString(),
        })),
        // Obuna muddati — .env dagi SUBSCRIPTION_UNTIL orqali sozlanadi
        subscriptionUntil: process.env.SUBSCRIPTION_UNTIL ?? null,
      }}
    >
      {children}
      {canPhone && <Softphone locale={session.locale} canConfigure={canConfigureTelephony} />}
    </AppShell>
  );
}
