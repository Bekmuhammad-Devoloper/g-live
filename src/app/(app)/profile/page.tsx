import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLE_LABELS, label, type Locale } from "@/lib/constants";
import ProfileView from "./ProfileView";

const p2 = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date | null) => (d ? `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` : "");
const fmt = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;

export default async function ProfilePage() {
  const s = await requireSession();
  const u = await prisma.user.findUnique({
    where: { id: s.userId },
    select: {
      fullName: true, email: true, phone: true, gender: true, birthDate: true, imageUrl: true,
      role: true, locale: true, position: true, sipExtension: true, createdAt: true, lastLoginAt: true,
      branch: { select: { name: true } },
    },
  });
  if (!u) return null;

  // Faoliyat statistikasi (rolga qarab mos keladigan qismi ko'rsatiladi)
  const [leads, tasksOpen, calls] = await Promise.all([
    prisma.lead.count({ where: { managerId: s.userId } }),
    prisma.task.count({ where: { assigneeId: s.userId, status: { not: "DONE" } } }),
    prisma.call.count({ where: { operatorId: s.userId } }),
  ]);

  return (
    <ProfileView
      locale={s.locale as Locale}
      me={{
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        gender: (u.gender as "MALE" | "FEMALE" | null) ?? null,
        birthDate: iso(u.birthDate),
        imageUrl: u.imageUrl,
        locale: u.locale,
        role: u.role,
        roleLabel: label(ROLE_LABELS, u.role, s.locale as Locale),
        branchName: u.branch?.name ?? null,
        position: u.position,
        sipExtension: u.sipExtension,
        joined: fmt(u.createdAt),
        lastLogin: u.lastLoginAt ? fmt(u.lastLoginAt) : null,
      }}
      stats={{ leads, tasksOpen, calls }}
    />
  );
}

export const dynamic = "force-dynamic";
