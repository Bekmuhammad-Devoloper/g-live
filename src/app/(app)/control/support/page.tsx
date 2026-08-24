import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { branchWhere } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { PageHeader, Card, StatCard, Table, EmptyRow, Badge, Forbidden } from "../../_components/ui";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];
const DAYS = 7;

// Qo'llab-quvvatlash analitikasi — tizimdan foydalanish: kim, qancha va qanday
// amallar bajargani (audit jurnali asosida, oxirgi 7 kun)
export default async function SupportAnalyticsPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim rahbariyat uchun.", ru: "Этот раздел для руководства.", en: "This section is for management." })} />;
  }
  const T = (uz: string, ru: string, en: string) => tr(s.locale, { uz, ru, en });

  const since = new Date(Date.now() - DAYS * 86_400_000);

  // AuditLog'da branchId yo'q — faol filial xodimlari (muallif) orqali cheklaymiz
  const branchStaff = s.branchId
    ? await prisma.user.findMany({ where: branchWhere(s), select: { id: true } })
    : null;
  const scope = branchStaff
    ? { createdAt: { gte: since }, actorId: { in: branchStaff.map((x) => x.id) } }
    : { createdAt: { gte: since } };

  const [total, cancels, byEntity, byActor] = await Promise.all([
    prisma.auditLog.count({ where: scope }),
    prisma.auditLog.count({ where: { ...scope, action: "CANCEL" } }),
    prisma.auditLog.groupBy({ by: ["entityType"], where: scope, _count: { _all: true } }),
    prisma.auditLog.groupBy({ by: ["actorId"], where: scope, _count: { _all: true } }),
  ]);

  const actorIds = byActor.map((a) => a.actorId).filter(Boolean) as string[];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, fullName: true, role: true } })
    : [];
  const actorMap = new Map(actors.map((a) => [a.id, a]));

  const topEntities = [...byEntity].sort((a, b) => b._count._all - a._count._all).slice(0, 8);
  const maxEntity = Math.max(1, ...topEntities.map((e) => e._count._all));
  const topActors = [...byActor].sort((a, b) => b._count._all - a._count._all).slice(0, 8);

  return (
    <>
      <PageHeader title={T("Qo'llab-quvvatlash analitikasi", "Аналитика поддержки", "Support analytics")} subtitle={T(`Tizimdan foydalanish faolligi (oxirgi ${DAYS} kun, audit asosida)`, `Активность использования системы (последние ${DAYS} дн., по аудиту)`, `System usage activity (last ${DAYS} days, from audit)`)} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label={T("Jami amallar", "Всего действий", "Total actions")} value={total} icon="history" />
        <StatCard label={T("Faol xodimlar", "Активных сотрудников", "Active staff")} value={actorIds.length} icon="user" />
        <StatCard label={T("Bekor qilishlar", "Отмены", "Cancellations")} value={cancels} tone={cancels ? "amber" : "green"} icon="eye" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-slate-700">{T("Bo'limlar bo'yicha amallar", "Действия по разделам", "Actions by module")}</h3>
          {topEntities.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">{T("Bu davrda amallar yo'q", "За этот период действий нет", "No actions in this period")}</p>
          ) : (
            <div className="space-y-2">
              {topEntities.map((e) => (
                <div key={e.entityType} className="flex items-center gap-3 text-xs">
                  <span className="w-28 shrink-0 truncate text-slate-500">{e.entityType}</span>
                  <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded bg-brand-500" style={{ width: `${(e._count._all / maxEntity) * 100}%` }} />
                  </div>
                  <span className="w-10 shrink-0 text-right font-semibold tabular-nums text-slate-700">{e._count._all}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card padded={false}>
          <div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-semibold text-slate-700">{T("Eng faol xodimlar", "Самые активные сотрудники", "Most active staff")}</h3></div>
          <Table head={<tr>
            <th className="px-4 py-3">{T("Xodim", "Сотрудник", "Staff")}</th>
            <th className="px-4 py-3">{T("Rol", "Роль", "Role")}</th>
            <th className="px-4 py-3 text-right">{T("Amallar", "Действия", "Actions")}</th>
          </tr>}>
            {topActors.length === 0 ? (
              <EmptyRow colSpan={3} text={T("Bu davrda faollik yo'q", "За этот период активности нет", "No activity in this period")} />
            ) : topActors.map((a) => {
              const u = a.actorId ? actorMap.get(a.actorId) : null;
              return (
                <tr key={a.actorId ?? "system"} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{u?.fullName ?? T("Tizim", "Система", "System")}</td>
                  <td className="px-4 py-3">{u ? <Badge tone="slate">{u.role}</Badge> : "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-700">{a._count._all}</td>
                </tr>
              );
            })}
          </Table>
        </Card>
      </div>
    </>
  );
}
