import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, canWrite, MODULES } from "@/lib/rbac";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import NoAttendanceView, { type VNoAtt } from "./NoAttendanceView";
import type { Prisma } from "@prisma/client";

const p2 = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const fmt = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;

export default async function NoAttendancePage() {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.REPORTS)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsat yo'q.", ru: "Нет доступа к этому разделу.", en: "You don't have access to this section." })} />;
  }

  // O'tgan, lekin davomati belgilanmagan darslar
  let where: Prisma.LessonWhereInput = { startsAt: { lte: new Date() }, attendances: { none: {} } };
  if (s.role === ROLES.TEACHER) where = { ...where, group: { teacherId: s.userId } };

  const lessons = await prisma.lesson.findMany({
    where,
    orderBy: { startsAt: "desc" },
    take: 2000,
    select: { id: true, startsAt: true, topic: true, groupId: true, group: { select: { name: true, teacher: { select: { fullName: true } } } } },
  });

  const canMark = canWrite(s.role, MODULES.ATTENDANCE);

  const rows: VNoAtt[] = lessons.map((l) => ({
    id: l.id,
    groupId: l.groupId,
    name: l.group.name + (l.topic ? ` — ${l.topic}` : ""),
    dateIso: isoDay(l.startsAt),
    dateLabel: fmt(l.startsAt),
    teacher: l.group.teacher?.fullName ?? null,
  }));

  const now = new Date();
  const from = isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = isoDay(now);

  return (
    <div className="space-y-4">
      <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(s.locale, { uz: "Davomat qilinmagan guruhlar", ru: "Группы без отмеченной посещаемости", en: "Groups without marked attendance" })}</h1>
      <NoAttendanceView rows={rows} defaultFrom={from} defaultTo={to} canMark={canMark} locale={s.locale} />
    </div>
  );
}
