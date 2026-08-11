import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import CancelledView, { type VCancelled } from "./CancelledView";

const p2 = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const fmt = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;

export default async function CancelledAttendancePage() {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.REPORTS)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsat yo'q.", ru: "Нет доступа к этому разделу.", en: "You don't have access to this section." })} />;
  }

  // Bekor qilingan / sababli davomat = status EXCUSED
  const recs = await prisma.attendance.findMany({
    where: { status: "EXCUSED" },
    orderBy: { markedAt: "desc" },
    take: 1000,
    select: {
      id: true, markedAt: true,
      student: { select: { fullName: true } },
      lesson: { select: { group: { select: { name: true, program: { select: { name: true } }, teacher: { select: { fullName: true } } } } } },
    },
  });

  const rows: VCancelled[] = recs.map((r) => ({
    id: r.id,
    student: r.student.fullName,
    group: r.lesson.group.name,
    course: r.lesson.group.program?.name ?? null,
    cancelledBy: r.lesson.group.teacher?.fullName ?? null,
    dateIso: isoDay(r.markedAt),
    dateLabel: fmt(r.markedAt),
  }));

  const now = new Date();
  const from = isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = isoDay(now);

  return <CancelledView rows={rows} defaultFrom={from} defaultTo={to} locale={s.locale} />;
}
