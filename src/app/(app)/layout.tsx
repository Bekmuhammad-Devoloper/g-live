import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { navFor } from "@/lib/nav";
import { getT } from "@/lib/i18n";
import { ROLES, ROLE_LABELS, label, isRopPosition } from "@/lib/constants";
import { canWrite, MODULES } from "@/lib/rbac";
import AppShell from "./_components/AppShell";
import { DialogHost } from "./_components/dialogs";
import Softphone from "./_components/Softphone";
import { getBrand } from "@/lib/brand";
import { disabledModules, INSTANCE_MODULES, isModuleEnabled } from "@/lib/instance";

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
    select: {
      position: true, imageUrl: true,
      branch: { select: { id: true, name: true, isActive: true } },
      branches: { select: { branch: { select: { id: true, name: true, isActive: true } } } },
    },
  });
  // Xodim ishlaydigan filiallar (asosiy + qo'shimcha). Bir nechta bo'lsa — faqat shular
  // orasida almashtira oladi; rahbariyat esa hamma filialni ko'radi.
  const ownBranches = [me?.branch, ...(me?.branches.map((b) => b.branch) ?? [])]
    .filter((b): b is { id: string; name: string; isActive: boolean } => !!b && b.isActive)
    .filter((b, i, arr) => arr.findIndex((x) => x.id === b.id) === i)
    .map((b) => ({ id: b.id, name: b.name }));
  const canSwitchOwn = !canSwitchBranch && ownBranches.length > 1;

  // Sotuv bo'limi rollari o'z portaliga ega (eski loyihadagi kabi).
  // Eski MANAGER yozuvlari uchun lavozim bo'yicha zaxira aniqlash saqlanadi.
  const portal =
    session.role === ROLES.ROP ? "rop"
    : session.role === ROLES.OPERATOR ? "operator"
    : session.role === ROLES.MANAGER ? (isRopPosition(me?.position) ? "rop" : "operator")
    : undefined;

  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86400000);

  const [branch, unreadCount, allBranches, students, lessons, groups] = await Promise.all([
    session.branchId ? prisma.branch.findUnique({ where: { id: session.branchId } }) : Promise.resolve(null),
    prisma.notification.count({ where: { userId: session.userId, isRead: false } }),
    canSwitchBranch
      ? prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([] as { id: string; name: string }[]),
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

  // Rahbariyat — barcha filiallar; qolganlar — o'z filiallari (bo'lmasa joriy filial)
  const branches = canSwitchBranch
    ? allBranches
    : ownBranches.length > 0 ? ownBranches : branch ? [{ id: branch.id, name: branch.name }] : [];

  const brand = await getBrand();
  const offPaths = [...disabledModules()].flatMap((m) => INSTANCE_MODULES[m].paths);
  const navItems = navFor(session.role).map((it) => ({
    href: it.href,
    icon: it.icon,
    label: t(it.i18nKey),
  }));

  return (
    <AppShell
      navItems={navItems}
      brand={{ name: brand.name, logo: brand.logo, logoDark: brand.logoDark }}
      offPaths={offPaths}
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
        canSwitchOwn,
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
      <DialogHost locale={session.locale} />
      {canPhone && isModuleEnabled("telephony") && <Softphone locale={session.locale} canConfigure={canConfigureTelephony} />}
    </AppShell>
  );
}
