import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatMoney, type Locale } from "@/lib/constants";
import { getT } from "@/lib/i18n";
import { Card, StatCard } from "../_components/ui";
import { StatusGrid, computeStatusCounts } from "./StatusGrid";
import LessonCalendar, { type CalLesson } from "./LessonCalendar";
import { groupColor } from "../groups/groupColor";

// CEO paneli — 12 status kartasi + qisqa jamlanma + haftalik dars jadvali.
export default async function CeoDashboard({ locale }: { locale: Locale }) {
  const t = getT(locale);

  // Joriy hafta (Yakshanbadan boshlab)
  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay(), 0, 0, 0);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

  const [counts, paidAgg, leads, weekLessons, teacherRows, groupRows, programRows] = await Promise.all([
    computeStatusCounts(),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID" } }),
    prisma.lead.count(),
    prisma.lesson.findMany({
      where: { startsAt: { gte: weekStart, lt: weekEnd } },
      include: { group: { include: { teacher: true, program: true } } },
    }),
    prisma.user.findMany({ where: { role: "TEACHER" }, select: { fullName: true }, orderBy: { fullName: "asc" } }),
    prisma.group.findMany({ select: { name: true, room: true }, orderBy: { name: "asc" } }),
    prisma.program.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  const calLessons: CalLesson[] = weekLessons.map((l) => {
    const s = l.startsAt;
    const e = l.endsAt ?? new Date(s.getTime() + 90 * 60000);
    return {
      id: l.id,
      groupId: l.groupId,
      day: s.getDay(),
      startMin: s.getHours() * 60 + s.getMinutes(),
      endMin: e.getHours() * 60 + e.getMinutes(),
      group: l.group.name,
      teacher: l.group.teacher?.fullName ?? null,
      room: l.group.room ?? null,
      course: l.group.program.name,
      color: groupColor(l.group.id, l.group.color),
      isPast: e.getTime() < now.getTime(),
    };
  });

  const rooms = [...new Set(groupRows.map((g) => g.room).filter((x): x is string => !!x))];

  return (
    <div className="space-y-6">
      {/* 12 status kartasi */}
      <StatusGrid counts={counts} locale={locale} />

      {/* Haftalik dars jadvali (filter + kalendar) */}
      <LessonCalendar
        locale={locale}
        lessons={calLessons}
        teachers={teacherRows.map((x) => x.fullName)}
        groups={groupRows.map((x) => x.name)}
        rooms={rooms}
        courses={programRows.map((x) => x.name)}
        todayIndex={now.getDay()}
      />

      {/* Qisqa jamlanma */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("reports.revenue")} value={formatMoney(paidAgg._sum.amount ?? 0, locale)} tone="green" icon="wallet" />
        <StatCard label={t("reports.activeStudents")} value={counts.activeStudents} tone="brand" icon="personStar" />
        <StatCard label={t("reports.leads")} value={leads} icon="personPlus" />
        <StatCard label={t("reports.groups")} value={counts.groups} tone="brand" icon="users" />
      </div>
    </div>
  );
}
