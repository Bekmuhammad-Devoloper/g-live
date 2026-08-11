import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import TeacherAttendanceWorkspace, { type VTeacher, type VAtt } from "./TeacherAttendanceWorkspace";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.TEACHER];
const HEAD = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];
const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date | null) => (d ? `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}` : "");
const isoDate = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

export default async function TeacherAttendancePage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return (
      <Forbidden
        title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })}
        body={tr(s.locale, { uz: "Bu bo'lim rahbariyat uchun.", ru: "Этот раздел для руководства.", en: "This section is for management." })}
      />
    );
  }

  // O'qituvchi bo'lsa — faqat o'z ma'lumoti (o'zini ko'radi, tahrir qila olmaydi)
  const isTeacher = s.role === ROLES.TEACHER;
  const [teachers, schedules, attendance, groups] = await Promise.all([
    prisma.user.findMany({ where: isTeacher ? { role: ROLES.TEACHER, id: s.userId } : { role: ROLES.TEACHER }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, fiksa: true } }),
    prisma.teacherSchedule.findMany({ where: isTeacher ? { teacherId: s.userId } : {} }),
    prisma.teacherAttendance.findMany({ where: isTeacher ? { teacherId: s.userId } : {} }),
    prisma.group.findMany({ where: { teacherId: isTeacher ? s.userId : { not: null }, status: { not: "CANCELLED" } }, select: { teacherId: true, weekdays: true } }),
  ]);

  const schedMap = new Map(schedules.map((x) => [x.teacherId, x]));

  // Har o'qituvchi uchun guruh kunlari birlashmasi (ish kunlari avtomatik shundan olinadi)
  const groupWdMap = new Map<string, Set<number>>();
  for (const g of groups) {
    if (!g.teacherId || !g.weekdays) continue;
    const set = groupWdMap.get(g.teacherId) ?? new Set<number>();
    for (const n of g.weekdays.split(",").map(Number)) if (n >= 1 && n <= 7) set.add(n);
    groupWdMap.set(g.teacherId, set);
  }

  const vteachers: VTeacher[] = teachers.map((t) => {
    const sc = schedMap.get(t.id);
    return {
      id: t.id,
      name: t.fullName,
      fiksa: t.fiksa,
      groupWeekdays: Array.from(groupWdMap.get(t.id) ?? []).sort((a, b) => a - b),
      schedule: sc
        ? {
            weekdays: sc.weekdays ? sc.weekdays.split(",").map(Number).filter((n) => n >= 1 && n <= 7) : [],
            startTime: sc.startTime,
            endTime: sc.endTime,
            monthlySalary: sc.monthlySalary,
            startedAt: fmtDate(sc.startedAt),
            startedAtIso: sc.startedAt ? isoDate(sc.startedAt) : "",
          }
        : null,
    };
  });

  const vatt: VAtt[] = attendance.map((a) => ({ teacherId: a.teacherId, date: isoDate(a.date), present: a.present }));

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${p2(now.getMonth() + 1)}`;
  const canManage = HEAD.includes(s.role as never); // o'qituvchi — faqat ko'radi

  return <TeacherAttendanceWorkspace teachers={vteachers} attendance={vatt} defaultMonth={defaultMonth} canManage={canManage} locale={s.locale} />;
}
