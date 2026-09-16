import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { branchWhere, branchViaGroup } from "@/lib/branchScope";
import LessonCalendar, { type CalLesson } from "./LessonCalendar";
import { groupColor } from "../groups/groupColor";
import { type Locale } from "@/lib/constants";
import { StatCard, HubCard } from "../_components/ui";
import { tr } from "@/lib/tr";
import { Icon } from "../_components/Icon";
import BranchSlotsEditor from "../branches/slots/BranchSlotsEditor";

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
  }, de: {
    users: "Benutzer", active: "Aktiv", branches: "Filialen", audit: "Audit-Einträge",
    byRole: "Nach Rolle", quick: "Technische Bereiche", recent: "Letzte Aktionen (Audit)",
    manageUsers: "Benutzer", manageUsersD: "Mitarbeiter, Rollen und Zugriffsrechte",
    settings: "Einstellungen", settingsD: "Systemparameter und RBAC-Matrix",
    auditLog: "Audit-Protokoll", auditLogD: "Unveränderliche Aktionshistorie",
    control: "Kontrolle", controlD: "Anomalien und unbestätigte Einträge",
    noData: "Keine Einträge", author: "Autor", action: "Aktion", object: "Objekt",
  },
};

export default async function AdminDashboard({ locale }: { locale: Locale }) {
  const t = T[locale] ?? T.uz;
  const s = await requireSession(); // faol filial doirasi

  // Joriy hafta (Yakshanbadan boshlab) — dars jadvali uchun
  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay(), 0, 0, 0);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

  // O'z filialidagi bo'sh xona/vaqtlar — ROP lidlar kanbanida filial ustunida ko'radi
  const myRooms = s.branchId ? await prisma.room.findMany({ where: { branchId: s.branchId, isActive: true }, select: { name: true, capacity: true } }) : [];
  const myBranch = s.branchId
    ? await prisma.branch.findUnique({ where: { id: s.branchId }, select: { id: true, name: true, slots: { select: { id: true, branchId: true, room: true, days: true, startTime: true, endTime: true, note: true, capacity: true }, orderBy: [{ room: "asc" }, { startTime: "asc" }] } } })
    : null;

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

      {/* Bo'sh xona / vaqt — filial administratori kiritadi, ROP lidlarni shu yerga yo'naltiradi */}
      {myBranch && (
        <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-card dark:border-emerald-500/20 dark:bg-[#15243d]">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600"><Icon name="clock" className="h-4 w-4" /></span>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {tr(locale, { uz: "Bo'sh xona / bo'sh vaqt", ru: "Свободные аудитории / время", en: "Free rooms / free time", de: "Freie Räume / freie Zeit" })} — {myBranch.name}
              </h3>
              <p className="text-xs text-slate-400">
                {tr(locale, { uz: "Yangi guruh ochish mumkin bo'lgan xona va vaqtlarni kiriting — ROP lidlarni shu yerga yo'naltiradi", ru: "Укажите аудитории и время для новых групп — РОП направит сюда лидов", en: "Enter rooms and times available for new groups — the sales head directs leads here", de: "Räume und Zeiten für neue Gruppen eintragen — der Vertriebsleiter leitet Leads hierher" })}
              </p>
            </div>
          </div>
          <div className="mt-3 max-w-xl">
            <BranchSlotsEditor
              branchId={myBranch.id}
              // Sig'im kartada yo'q bo'lsa — Xonalar bo'limidagi xona sig'imi (nom bo'yicha)
              initial={myBranch.slots.map((sl) => ({ ...sl, capacity: sl.capacity ?? (myRooms.find((r) => r.name.trim().toLowerCase() === sl.room.trim().toLowerCase())?.capacity || null) }))}
              canEdit
              locale={locale}
            />
          </div>
        </div>
      )}

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
