import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import LessonCalendar, { type CalLesson } from "../dashboard/LessonCalendar";
import { groupColor } from "../groups/groupColor";
import type { Prisma } from "@prisma/client";

// weekdays: 1=Du..7=Ya  →  LessonCalendar day: 0=Yak..6=Sha
const toCalDay = (wd: number) => (wd === 7 ? 0 : wd);
const toMin = (t: string | null) => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
const p2 = (n: number) => String(n).padStart(2, "0");
const isoLocal = (d: Date | null) => (d ? `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` : null);

export default async function SchedulePage() {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.GROUPS)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsat yo'q.", ru: "Нет доступа к этому разделу.", en: "You do not have access to this section." })} />;
  }

  let where: Prisma.GroupWhereInput = { status: { not: "CANCELLED" } };
  if (s.role === ROLES.TEACHER) where = { ...where, teacherId: s.userId };

  const groups = await prisma.group.findMany({
    where,
    include: {
      teacher: { select: { fullName: true } },
      program: { select: { name: true } },
      _count: { select: { students: true } }, // blokdagi "9 / 12" uchun
    },
    orderBy: { name: "asc" },
  });

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todayCal = now.getDay();

  const calLessons: CalLesson[] = [];
  for (const g of groups) {
    const days = g.weekdays ? g.weekdays.split(",").map(Number).filter((n) => n >= 1 && n <= 7) : [];
    const startMin = toMin(g.startTime);
    if (!days.length || startMin === null) continue;
    const endMin = toMin(g.endTime) ?? startMin + 90;
    for (const wd of days) {
      const day = toCalDay(wd);
      calLessons.push({
        id: `${g.id}-${wd}`,
        groupId: g.id,
        day,
        startMin,
        endMin,
        group: g.name,
        teacher: g.teacher?.fullName ?? null,
        room: g.room ?? null,
        course: g.program.name,
        color: groupColor(g.id, g.color),
        startISO: isoLocal(g.startDate),
        endISO: isoLocal(g.endDate),
        students: g._count.students,
        capacity: g.capacity,
        isPast: day < todayCal || (day === todayCal && endMin < nowMin),
      });
    }
  }

  const teachers = [...new Set(groups.map((g) => g.teacher?.fullName).filter((x): x is string => !!x))];
  const groupNames = [...new Set(groups.map((g) => g.name))];
  const rooms = [...new Set(groups.map((g) => g.room).filter((x): x is string => !!x))];
  const courses = [...new Set(groups.map((g) => g.program.name))];

  return (
    <div className="space-y-4">
      <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(s.locale, { uz: "Dars jadvali", ru: "Расписание уроков", en: "Lesson schedule" })}</h1>
      <LessonCalendar
        locale={s.locale}
        lessons={calLessons}
        teachers={teachers}
        groups={groupNames}
        rooms={rooms}
        courses={courses}
        todayIndex={todayCal}
        todayISO={isoLocal(now)!}
        weekNav
        defaultView="list"
      />
    </div>
  );
}
