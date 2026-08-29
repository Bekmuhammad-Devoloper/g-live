import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES, ROLE_LABELS, label } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { PageHeader, Card, HubCard, StatCard, Badge, Forbidden } from "../_components/ui";

const ALLOWED = [ROLES.DIRECTOR, ROLES.ADMIN];

export default async function ManagementPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim faqat direktor va administrator uchun.", ru: "Этот раздел только для директора и администратора.", en: "This section is for directors and administrators only.", de: "Dieser Bereich ist nur für Direktoren und Administratoren." })} />;
  }

  const [users, branches, auditCount, students, groups] = await Promise.all([
    prisma.user.findMany({ select: { role: true, isActive: true } }),
    prisma.branch.findMany({ include: { _count: { select: { users: true, students: true, groups: true } } } }),
    prisma.auditLog.count(),
    prisma.student.count(),
    prisma.group.count(),
  ]);

  const byRole = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader title={tr(s.locale, { uz: "Boshqaruv", ru: "Управление", en: "Management", de: "Verwaltung" })} subtitle={tr(s.locale, { uz: "Foydalanuvchilar, filiallar va tizim nazorati", ru: "Пользователи, филиалы и контроль системы", en: "Users, branches and system control", de: "Benutzer, Filialen und Systemkontrolle" })} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={tr(s.locale, { uz: "Foydalanuvchilar", ru: "Пользователи", en: "Users", de: "Benutzer" })} value={users.length} tone="brand" icon="users" />
        <StatCard label={tr(s.locale, { uz: "Filiallar", ru: "Филиалы", en: "Branches", de: "Filialen" })} value={branches.length} icon="layout" />
        <StatCard label={tr(s.locale, { uz: "O'quvchilar", ru: "Ученики", en: "Students", de: "Schüler" })} value={students} icon="graduation" />
        <StatCard label={tr(s.locale, { uz: "Audit yozuvlari", ru: "Записи аудита", en: "Audit records", de: "Audit-Einträge" })} value={auditCount} icon="history" />
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <HubCard href="/users" icon="users" title={tr(s.locale, { uz: "Foydalanuvchilar", ru: "Пользователи", en: "Users", de: "Benutzer" })} desc={tr(s.locale, { uz: "Xodimlar, rollar va kirish huquqlari", ru: "Сотрудники, роли и права доступа", en: "Staff, roles and access rights", de: "Mitarbeiter, Rollen und Zugriffsrechte" })} stat={users.length} />
        <HubCard href="/audit" icon="history" title={tr(s.locale, { uz: "Audit jurnali", ru: "Журнал аудита", en: "Audit log", de: "Audit-Protokoll" })} desc={tr(s.locale, { uz: "O'zgartirib bo'lmaydigan amallar tarixi", ru: "История неизменяемых действий", en: "History of immutable actions", de: "Verlauf unveränderlicher Aktionen" })} stat={auditCount} />
        <HubCard href="/control" icon="eye" title={tr(s.locale, { uz: "Nazorat", ru: "Контроль", en: "Control", de: "Kontrolle" })} desc={tr(s.locale, { uz: "Anomaliyalar va tasdiqlanmagan yozuvlar", ru: "Аномалии и неподтверждённые записи", en: "Anomalies and unconfirmed records", de: "Anomalien und unbestätigte Einträge" })} />
        <HubCard href="/settings" icon="settings" title={tr(s.locale, { uz: "Sozlamalar", ru: "Настройки", en: "Settings", de: "Einstellungen" })} desc={tr(s.locale, { uz: "Tizim parametrlari va biznes-qoidalar", ru: "Параметры системы и бизнес-правила", en: "System parameters and business rules", de: "Systemparameter und Geschäftsregeln" })} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">{tr(s.locale, { uz: "Rollar bo'yicha taqsimot", ru: "Распределение по ролям", en: "Distribution by role", de: "Verteilung nach Rolle" })}</h3>
          <div className="space-y-2">
            {Object.entries(byRole)
              .sort((a, b) => b[1] - a[1])
              .map(([role, n]) => (
                <div key={role} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-sm text-slate-700">{label(ROLE_LABELS, role, s.locale)}</span>
                  <Badge tone="brand">{n}</Badge>
                </div>
              ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">{tr(s.locale, { uz: "Filiallar", ru: "Филиалы", en: "Branches", de: "Filialen" })}</h3>
          {branches.length === 0 ? (
            <p className="text-sm text-slate-400">{tr(s.locale, { uz: "Filial yo'q", ru: "Нет филиалов", en: "No branches", de: "Keine Filialen" })}</p>
          ) : (
            <div className="space-y-2">
              {branches.map((b) => (
                <div key={b.id} className="rounded-lg border border-slate-200/70 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">{b.name}</span>
                    {b.isActive ? <Badge tone="green">{tr(s.locale, { uz: "Faol", ru: "Активен", en: "Active", de: "Aktiv" })}</Badge> : <Badge tone="slate">{tr(s.locale, { uz: "Nofaol", ru: "Неактивен", en: "Inactive", de: "Inaktiv" })}</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {b.address ?? "—"} · {b._count.users} {tr(s.locale, { uz: "xodim", ru: "сотр.", en: "staff", de: "Mitarb." })} · {b._count.students} {tr(s.locale, { uz: "o'quvchi", ru: "ученик", en: "student", de: "Schüler" })} · {b._count.groups} {tr(s.locale, { uz: "guruh", ru: "группа", en: "group", de: "Gruppe" })}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-slate-400">{tr(s.locale, { uz: `Guruhlar: ${groups} ta`, ru: `Групп: ${groups}`, en: `Groups: ${groups}`, de: `Gruppen: ${groups}` })}</p>
        </Card>
      </div>
    </>
  );
}
