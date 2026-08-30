import { redirect } from "next/navigation";
import { S } from "../_i18n";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import MissingStudent from "../MissingStudent";
import { CARD, ICON_GRADIENT, PageHeader, fmtDate } from "../_ui";
import MessageForm from "./MessageForm";
import { MESSAGE_SENT } from "./const";

// "Ustozga yozish" — o'quvchi guruh ustoziga xabar yuboradi.

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

  const sent = await prisma.notification.findMany({
    where: { userId: session.userId, event: MESSAGE_SENT },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, body: true, createdAt: true },
  });

  const initials = (teacher?.fullName ?? "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-4">
      <PageHeader title={t.writeTeacher} subtitle={group?.name ?? "—"} back="/student/kurse" />

      {/* Ustoz kartasi */}
      <div className={`${CARD} flex items-center gap-3 p-4`}>
        {teacher?.imageUrl ? (
          <img src={teacher.imageUrl} alt={teacher.fullName} className="h-12 w-12 shrink-0 rounded-full object-cover" />
        ) : (
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[16px] font-extrabold text-white"
            style={{ background: ICON_GRADIENT }}
          >
            {initials}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-extrabold text-slate-900">{teacher?.fullName ?? t.noTeacher}</div>
          <div className="truncate text-[12.5px] text-slate-500">{teacher ? t.yourTeacher : t.askAdmin}</div>
        </div>
      </div>

      <MessageForm disabled={!group?.teacherId} t={t} />

      {sent.length > 0 && (
        <div className="space-y-2">
          <div className="px-1 text-[13px] font-bold text-slate-500">{t.sentMessages}</div>
          {sent.map((m) => (
            <div key={m.id} className={`${CARD} p-3.5`}>
              <div className="whitespace-pre-wrap break-words text-[14px] text-slate-800">{m.body}</div>
              <div className="mt-1.5 text-[11.5px] text-slate-400">{fmtDate(m.createdAt)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
