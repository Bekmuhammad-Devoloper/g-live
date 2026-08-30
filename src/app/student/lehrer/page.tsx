import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { S } from "../_i18n";
import { CARD, ICON_GRADIENT, PageHeader } from "../_ui";
import MissingStudent from "../MissingStudent";
import Chat, { type VMsg } from "./Chat";

// "Ustozga yozish" — o'quvchi va ustoz o'rtasidagi yozishma.
// Ustoz javobini CRM dagi /chat sahifasidan yozadi.

export default async function StudentLehrerPage() {
  const session = await getSession();
  if (!session) redirect("/login");
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
  }));

  const hasUnread = rows.some((m) => !m.fromStudent && !m.readAt);

  const initials = (teacher?.fullName ?? "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-3">
      <PageHeader title={t.writeTeacher} subtitle={group?.name ?? "—"} back="/student/kurse" />

      {/* Ustoz */}
      <div className={CARD + " flex items-center gap-3 p-3.5"}>
        {teacher?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={teacher.imageUrl} alt={teacher.fullName} className="h-11 w-11 shrink-0 rounded-full object-cover" />
        ) : (
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[15px] font-extrabold text-white"
            style={{ background: ICON_GRADIENT }}
          >
            {initials}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-extrabold text-slate-900">{teacher?.fullName ?? t.noTeacher}</div>
          <div className="truncate text-[12px] text-slate-500">{teacher ? t.yourTeacher : t.askAdmin}</div>
        </div>
      </div>

      <Chat messages={messages} disabled={!group?.teacherId} t={t} hasUnread={hasUnread} />
    </div>
  );
}
