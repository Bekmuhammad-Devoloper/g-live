import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { canRead, MODULES } from "@/lib/rbac";
import { branchViaGroup } from "@/lib/branchScope";
import { ROLES, ATTENDANCE_STATUS_LABELS, label } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { PageHeader, Forbidden } from "../_components/ui";
import AttendanceView, { type VLesson } from "./AttendanceView";
import type { Prisma } from "@prisma/client";

const CAN_MARK_ROLES = [ROLES.TEACHER, ROLES.DEPUTY_DIRECTOR];
const p2 = (n: number) => String(n).padStart(2, "0");
// Serverda deterministik sana formati (hidratsiya xatolarining oldini olish uchun)
const fmtDateTime = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;

export default async function AttendancePage() {
  const s = await requireSession();
  const t = getT(s.locale);

  if (!canRead(s.role, MODULES.ATTENDANCE)) {
    return <Forbidden title={t("err.forbidden")} body={t("err.forbiddenBody")} />;
  }

  let where: Prisma.LessonWhereInput = {};
  if (s.role === ROLES.TEACHER) {
    where = { group: { teacherId: s.userId } };
  } else if (s.role === ROLES.STUDENT) {
    const st = await prisma.student.findUnique({ where: { userId: s.userId } });
    where = { group: { students: { some: { studentId: st?.id ?? "__none__" } } } };
  }
  // O'quvchi/ota-ona o'z darslarini filialdan qat'i nazar ko'radi, xodimlar — faol filial doirasida
  const selfScoped = s.role === ROLES.STUDENT || s.role === ROLES.PARENT;
  if (!selfScoped) where = { AND: [where, branchViaGroup(s)] };

  const lessons = await prisma.lesson.findMany({
    where,
    orderBy: { startsAt: "desc" },
    take: 50,
    include: {
      group: {
        include: {
          students: {
            where: { isActive: true },
            include: { student: { select: { id: true, fullName: true } } },
          },
        },
      },
      attendances: true,
    },
  });

  const canMark = CAN_MARK_ROLES.includes(s.role as never);

  const vlessons: VLesson[] = lessons.map((l) => {
    const byStudent = new Map(l.attendances.map((a) => [a.studentId, a.status]));
    const students = l.group.students
      .map((gs) => ({ id: gs.student.id, name: gs.student.fullName, status: byStudent.get(gs.student.id) ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const present = l.attendances.filter((a) => ["PRESENT", "LATE", "ONLINE"].includes(a.status)).length;
    const confirmed = l.attendances.length > 0 && l.attendances.every((a) => a.confirmed);
    return {
      id: l.id,
      dateLabel: fmtDateTime(l.startsAt),
      groupName: l.group.name,
      topic: l.topic ?? null,
      present,
      total: students.length,
      confirmed,
      students,
    };
  });

  return (
    <>
      <PageHeader title={t("nav.attendance")} subtitle={tr(s.locale, { uz: "QR-davomat asosidagi darslar (TZ FR-HW-06/07/08)", ru: "Занятия на основе QR-посещаемости (ТЗ FR-HW-06/07/08)", en: "QR-attendance based lessons (spec FR-HW-06/07/08)", de: "QR-Anwesenheit-basierte Unterrichte (Spezifikation FR-HW-06/07/08)" })} />
      <AttendanceView lessons={vlessons} canMark={canMark} locale={s.locale} />
      <p className="mt-3 text-xs text-slate-400">
        ℹ️ {tr(s.locale, { uz: "Dinamik QR-kod generatsiyasi va skanerlash oqimi keyingi iteratsiyada ulanadi.", ru: "Динамическая генерация QR-кода и поток сканирования будут подключены в следующей итерации.", en: "Dynamic QR-code generation and scanning flow will be added in the next iteration.", de: "Die dynamische QR-Code-Generierung und der Scan-Vorgang werden in der nächsten Iteration hinzugefügt." })}
        {" "}{tr(s.locale, { uz: "Status turlari:", ru: "Типы статусов:", en: "Status types:", de: "Statustypen:" })} {ATTENDANCE_STATUS_LABELS && Object.keys(ATTENDANCE_STATUS_LABELS).map((k) => label(ATTENDANCE_STATUS_LABELS, k, s.locale)).join(", ")}.
      </p>
    </>
  );
}
