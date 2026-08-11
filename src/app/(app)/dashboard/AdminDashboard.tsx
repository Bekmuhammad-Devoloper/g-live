import { prisma } from "@/lib/db";
import { ROLE_LABELS, label, intlLocale, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Card, StatCard, HubCard, Table, EmptyRow, Badge } from "../_components/ui";

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

const actionTone: Record<string, "green" | "red" | "amber" | "blue" | "slate"> = {
  CREATE: "green", UPDATE: "amber", CANCEL: "red", DELETE: "red", LOGIN: "blue",
};

export default async function AdminDashboard({ locale }: { locale: Locale }) {
  const t = T[locale] ?? T.uz;

  const [users, activeUsers, branches, auditCount, recentAudit] = await Promise.all([
    prisma.user.findMany({ select: { role: true } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.branch.count(),
    prisma.auditLog.count(),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: true } }),
  ]);

  const byRole = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

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

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Rollar taqsimoti */}
        <Card className="lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">{t.byRole}</h3>
          <div className="space-y-2">
            {Object.entries(byRole)
              .sort((a, b) => b[1] - a[1])
              .map(([role, n]) => (
                <div key={role} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-sm text-slate-700">{label(ROLE_LABELS, role, locale)}</span>
                  <Badge tone="brand">{n}</Badge>
                </div>
              ))}
          </div>
        </Card>

        {/* Oxirgi audit */}
        <Card className="lg:col-span-3" padded={false}>
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-700">{t.recent}</h3>
          </div>
          <Table
            head={
              <tr>
                <th className="px-4 py-3">{t.author}</th>
                <th className="px-4 py-3">{t.action}</th>
                <th className="px-4 py-3">{t.object}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Sana", ru: "Дата", en: "Date" })}</th>
              </tr>
            }
          >
            {recentAudit.length === 0 ? (
              <EmptyRow colSpan={4} text={t.noData} />
            ) : (
              recentAudit.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{l.actor?.fullName ?? "—"}</td>
                  <td className="px-4 py-3"><Badge tone={actionTone[l.action] ?? "slate"}>{l.action}</Badge></td>
                  <td className="px-4 py-3 text-slate-600">{l.entityType}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "short", timeStyle: "short" }).format(l.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </Table>
        </Card>
      </div>
    </div>
  );
}
