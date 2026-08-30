import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isPortalFeatureOn } from "@/lib/portalFeatures";
import { prisma } from "@/lib/db";
import { S } from "../_i18n";
import MissingStudent from "../MissingStudent";
import Chat, { type VMsg } from "./Chat";

// "Ustozga yozish" — o'quvchi va ustoz o'rtasidagi yozishma.
// Ustoz javobini CRM dagi /chat sahifasidan yozadi.

export default async function StudentLehrerPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  // Bo'lim menejer tomonidan o'chirilgan bo'lsa — bosh sahifaga
  if (!(await isPortalFeatureOn("lehrer"))) redirect("/student");
  const t = S(session.locale);

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      enrollments: {
        where: { isActive: true },
        orderBy: { joinedAt: "desc" },
        take: 1,
        select: {
          group: {
            select: {
              name: true,
              teacherId: true,
              // Parol maydonlari RSC yukiga tushmasligi uchun select bilan
              teacher: { select: { fullName: true, imageUrl: true } },
            },
          },
        },
      },
    },
  });
  if (!student) return <MissingStudent />;

  const group = student.enrollments[0]?.group ?? null;
  const teacher = group?.teacher ?? null;

  const rows = await prisma.chatMessage.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: "asc" },
    take: 300,
    select: {
      id: true,
      fromStudent: true,
      text: true,
      createdAt: true,
      readAt: true,
      author: { select: { fullName: true } },
    },
  });

  const messages: VMsg[] = rows.map((m) => ({
    id: m.id,
    mine: m.fromStudent,
    text: m.text,
    at: m.createdAt.toISOString(),
    author: m.fromStudent ? null : (m.author?.fullName ?? teacher?.fullName ?? null),
    read: !!m.readAt,
  }));

  const hasUnread = rows.some((m) => !m.fromStudent && !m.readAt);

  const initials = (teacher?.fullName ?? "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <Chat
      messages={messages}
      disabled={!group?.teacherId}
      t={t}
      hasUnread={hasUnread}
      title={teacher?.fullName ?? t.noTeacher}
      subtitle={teacher ? (group?.name ?? t.yourTeacher) : t.askAdmin}
      avatarUrl={teacher?.imageUrl ?? null}
      initials={initials}
    />
  );
}
