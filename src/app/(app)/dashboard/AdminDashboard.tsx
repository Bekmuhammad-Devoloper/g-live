import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { branchWhere, branchViaGroup } from "@/lib/branchScope";
import LessonCalendar, { type CalLesson } from "./LessonCalendar";
import { groupColor } from "../groups/groupColor";
import { type Locale } from "@/lib/constants";
import { StatCard, HubCard } from "../_components/ui";

const T: Record<Locale, Record<string, string>> = {
  uz: {
    users: "Foydalanuvchilar", active: "Faol", branches: "Filiallar", audit: "Audit yozuvlari",
    byRole: "Rollar bo'yicha", quick: "Texnik bo'limlar", recent: "Oxirgi amallar (audit)",
    manageUsers: "Foydalanuvchilar", manageUsersD: "Xodimlar, rollar va kirish huquqlari",
    settings: "Sozlamalar", settingsD: "Tizim parametrlari va RBAC matritsasi",
    auditLog: "Audit jurnali", auditLogD: "O'zgartirib bo'lmaydigan amallar tarixi",
    control: "Nazorat", controlD: "Anomaliyalar va tasdiqlanmagan yozuvlar",
    noData: "Yozuv yo'q", author: "Muallif", action: "Amal", object: "Obyekt",
  },
  ru: {
    users: "Пользователи", active: "Активные", branches: "Филиалы", audit: "Записи аудита",
    byRole: "По ролям", quick: "Технические разделы", recent: "Последние действия (аудит)",
    manageUsers: "Пользователи", manageUsersD: "Сотрудники, роли и права доступа",
    settings: "Настройки", settingsD: "Параметры системы и матрица RBAC",
    auditLog: "Журнал аудита", auditLogD: "Неизменяемая история действий",
    control: "Контроль", controlD: "Аномалии и неподтверждённые записи",
    noData: "Нет записей", author: "Автор", action: "Действие", object: "Объект",
  },
  en: {
    users: "Users", active: "Active", branches: "Branches", audit: "Audit entries",
    byRole: "By role", quick: "Technical sections", recent: "Recent actions (audit)",
    manageUsers: "Users", manageUsersD: "Staff, roles and access rights",
    settings: "Settings", settingsD: "System parameters and RBAC matrix",
    auditLog: "Audit log", auditLogD: "Immutable action history",
    control: "Control", controlD: "Anomalies and unconfirmed records",
    noData: "No records", author: "Author", action: "Action", object: "Object",
  },
};

export default async function AdminDashboard({ locale }: { locale: Locale }) {
  const t = T[locale] ?? T.uz;
  const s = await requireSession(); // faol filial doirasi

  // Joriy hafta (Yakshanbadan boshlab) — dars jadvali uchun
  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay(), 0, 0, 0);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

  const [users, activeUsers, branches, auditCount, weekLessons, teacherRows, groupRows, programRows] = await Promise.all([
    prisma.user.findMany({ where: branchWhere(s), select: { role: true } }),
    prisma.user.count({ where: { AND: [{ isActive: true }, branchWhere(s)] } }),
    prisma.branch.count(),
    prisma.auditLog.count(),
    prisma.lesson.findMany({
      where: { AND: [{ startsAt: { gte: weekStart, lt: weekEnd } }, branchViaGroup(s)] },
      include: { group: { include: { teacher: true, program: true } } },
    }),
    prisma.user.findMany({ where: { AND: [{ role: "TEACHER" }, branchWhere(s)] }, select: { fullName: true }, orderBy: { fullName: "asc" } }),
    prisma.group.findMany({ where: branchWhere(s), select: { name: true, room: true }, orderBy: { name: "asc" } }),
    prisma.program.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  const calLessons: CalLesson[] = weekLessons.map((l) => {
    const st = l.startsAt;
    const en = l.endsAt ?? new Date(st.getTime() + 90 * 60000);
    return {
      id: l.id,
      groupId: l.groupId,
      day: st.getDay(),
      startMin: st.getHours() * 60 + st.getMinutes(),
      endMin: en.getHours() * 60 + en.getMinutes(),
      group: l.group.name,
      teacher: l.group.teacher?.fullName ?? null,
      room: l.group.room ?? null,
      course: l.group.program.name,
      color: groupColor(l.group.id, l.group.color),
      isPast: en.getTime() < now.getTime(),
    };
  });

  const rooms = [...new Set(groupRows.map((g) => g.room).filter((x): x is string => !!x))];

  return (
    <div className="space-y-6">
      {/* Texnik KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t.users} value={users.length} tone="brand" icon="users" />
        <StatCard label={t.active} value={activeUsers} tone="green" icon="check" />
        <StatCard label={t.branches} value={branches} icon="layout" />
        <StatCard label={t.audit} value={auditCount} icon="history" />
      </div>

      {/* Texnik bo'limlar */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">{t.quick}</h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <HubCard href="/users" icon="users" title={t.manageUsers} desc={t.manageUsersD} stat={users.length} />
          <HubCard href="/settings" icon="settings" title={t.settings} desc={t.settingsD} />
          <HubCard href="/audit" icon="history" title={t.auditLog} desc={t.auditLogD} stat={auditCount} />
          <HubCard href="/control" icon="eye" title={t.control} desc={t.controlD} />
        </div>
      </div>

      {/* Dars jadvali — qatorlar GURUHLAR bo'yicha (xona/o'qituvchiga ham almashtirsa bo'ladi) */}
      <LessonCalendar
        locale={locale}
        lessons={calLessons}
        teachers={teacherRows.map((x) => x.fullName)}
        groups={groupRows.map((x) => x.name)}
        rooms={rooms}
        courses={programRows.map((x) => x.name)}
        todayIndex={now.getDay()}
        defaultView="list"
        defaultGroupMode="group"
      />

    </div>
  );
}
