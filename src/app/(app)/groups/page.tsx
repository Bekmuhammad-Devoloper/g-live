import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { canRead, getPermission, MODULES } from "@/lib/rbac";
import { ROLES } from "@/lib/constants";
import { branchWhere } from "@/lib/branchScope";
import { Forbidden } from "../_components/ui";
import GroupsView, { type VGroup } from "./GroupsView";
import type { Prisma } from "@prisma/client";

const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date | null) => (d ? `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}` : "");

export default async function GroupsPage() {
  const s = await requireSession();
  const t = getT(s.locale);

  if (!canRead(s.role, MODULES.GROUPS)) {
    return <Forbidden title={t("err.forbidden")} body={t("err.forbiddenBody")} />;
  }

  // Ko'lam cheklovi: har rol faqat o'ziga tegishlisini ko'radi
  let where: Prisma.GroupWhereInput = {};
  if (s.role === ROLES.TEACHER) {
    where = { teacherId: s.userId };
  } else if (s.role === ROLES.STUDENT) {
    const st = await prisma.student.findUnique({ where: { userId: s.userId } });
    where = { students: { some: { studentId: st?.id ?? "__none__" } } };
  } else if (s.role === ROLES.PARENT) {
    const parent = await prisma.parent.findUnique({ where: { userId: s.userId }, include: { children: true } });
    const ids = parent?.children.map((c) => c.studentId) ?? [];
    where = { students: { some: { studentId: { in: ids.length ? ids : ["__none__"] } } } };
  }
  // Xodimlar faol filial guruhlarinigina ko'radi (o'quvchi/ota-ona o'z guruhini har doim ko'radi)
  if (![ROLES.STUDENT, ROLES.PARENT].includes(s.role as never)) {
    where = { AND: [where, branchWhere(s)] };
  }

  const [groups, totalStudents, frozenStudents] = await Promise.all([
    prisma.group.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        teacher: { select: { fullName: true } },
        program: { select: { name: true } },
        _count: { select: { students: true } },
      },
    }),
    prisma.groupStudent.count({ where: { group: where } }),
    prisma.groupStudent.count({ where: { isActive: false, group: where } }),
  ]);

  const vgroups: VGroup[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    program: g.program.name,
    level: g.levelCode,
    teacherName: g.teacher?.fullName ?? null,
    weekdays: g.weekdays ? g.weekdays.split(",").map(Number).filter((n) => n >= 1 && n <= 7) : [],
    startTime: g.startTime,
    endTime: g.endTime,
    groupTime: fmtDate(g.startDate),
    groupEndTime: fmtDate(g.endDate),
    students: g._count.students,
    capacity: g.capacity,
    room: g.room,
    status: g.status,
    programId: g.programId,
    teacherId: g.teacherId,
    color: g.color,
    format: g.format,
    onlineLink: g.onlineLink,
    startDate: g.startDate ? g.startDate.toISOString().slice(0, 10) : null,
    endDate: g.endDate ? g.endDate.toISOString().slice(0, 10) : null,
    note: g.note,
    monthlyFee: g.monthlyFee,
  }));

  const canCreate = getPermission(s.role, MODULES.GROUPS) === "FULL";
  const [programs, teachers, roomOptions] = canCreate
    ? await Promise.all([
        prisma.program.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
        prisma.user.findMany({ where: { role: ROLES.TEACHER }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
        prisma.room.findMany({ where: { isActive: true }, select: { id: true, name: true, capacity: true }, orderBy: { name: "asc" } }),
      ])
    : [[], [], []];

  // Filtr variantlari
  const teacherNames = Array.from(new Set(vgroups.map((g) => g.teacherName).filter(Boolean))) as string[];
  const programNames = Array.from(new Set(vgroups.map((g) => g.program)));
  const rooms = Array.from(new Set(vgroups.map((g) => g.room).filter(Boolean))) as string[];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{t("nav.groups")}</h1>
      </div>
      <GroupsView
        locale={s.locale}
        groups={vgroups}
        totalStudents={totalStudents}
        frozenStudents={frozenStudents}
        canCreate={canCreate}
        programs={programs}
        teachers={teachers}
        teacherNames={teacherNames.sort()}
        programNames={programNames.sort()}
        rooms={rooms.sort()}
        roomOptions={roomOptions}
      />
    </div>
  );
}
