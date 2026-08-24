import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { branchViaLesson } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { PageHeader, Card, StatCard, Table, EmptyRow, Forbidden } from "../../_components/ui";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];
const DAYS = 14;

const p2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// Turniket analitikasi — QR orqali kirishlar statistikasi (Attendance method=QR)
export default async function TurnstilePage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim rahbariyat uchun.", ru: "Этот раздел для руководства.", en: "This section is for management." })} />;
  }
  const T = (uz: string, ru: string, en: string) => tr(s.locale, { uz, ru, en });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const since = new Date(todayStart);
  since.setDate(since.getDate() - (DAYS - 1));

  const entries = await prisma.attendance.findMany({
    where: { AND: [{ method: "QR", markedAt: { gte: since } }, branchViaLesson(s)] }, // faol filial doirasida
    select: { markedAt: true, anomaly: true, studentId: true, lesson: { select: { group: { select: { name: true } } } } },
  });

  // Kunlik kirishlar (oxirgi 14 kun)
  const byDay = new Map<string, number>();
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(since); d.setDate(d.getDate() + i);
    byDay.set(isoOf(d), 0);
  }
  const byGroup = new Map<string, number>();
  let today = 0, anomalies = 0;
  const todayStudents = new Set<string>();
  for (const e of entries) {
    const key = isoOf(e.markedAt);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
    if (e.markedAt >= todayStart) { today++; todayStudents.add(e.studentId); }
    if (e.anomaly) anomalies++;
    const g = e.lesson.group.name;
    byGroup.set(g, (byGroup.get(g) ?? 0) + 1);
  }
  const dayRows = Array.from(byDay.entries());
  const maxDay = Math.max(1, ...dayRows.map(([, n]) => n));
  const topGroups = Array.from(byGroup.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxGroup = Math.max(1, ...topGroups.map(([, n]) => n));
  const fmtDay = new Intl.DateTimeFormat(s.locale === "ru" ? "ru-RU" : "uz-UZ", { day: "2-digit", month: "2-digit" });

  return (
    <>
      <PageHeader title={T("Turniket analitikasi", "Аналитика турникета", "Turnstile analytics")} subtitle={T("QR orqali belgilangan kirishlar statistikasi", "Статистика входов, отмеченных по QR", "Statistics of QR check-ins")} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={T("Bugun kirishlar", "Входов сегодня", "Entries today")} value={today} icon="shieldCheck" />
        <StatCard label={T("Bugun o'quvchilar", "Учеников сегодня", "Students today")} value={todayStudents.size} icon="user" />
        <StatCard label={T(`${DAYS} kunda kirishlar`, `Входов за ${DAYS} дн.`, `Entries in ${DAYS}d`)} value={entries.length} icon="chart" />
        <StatCard label={T("Anomaliyalar", "Аномалии", "Anomalies")} value={anomalies} tone={anomalies ? "red" : "green"} icon="eye" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-slate-700">{T("Kunlik kirishlar (oxirgi 14 kun)", "Входы по дням (последние 14 дней)", "Daily entries (last 14 days)")}</h3>
          <div className="space-y-2">
            {dayRows.map(([iso, n]) => (
              <div key={iso} className="flex items-center gap-3 text-xs">
                <span className="w-12 shrink-0 tabular-nums text-slate-500">{fmtDay.format(new Date(iso + "T00:00:00"))}</span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded bg-brand-500" style={{ width: `${(n / maxDay) * 100}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right font-semibold tabular-nums text-slate-700">{n}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card padded={false}>
          <div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-semibold text-slate-700">{T("Guruhlar bo'yicha (14 kun)", "По группам (14 дней)", "By group (14 days)")}</h3></div>
          <Table head={<tr>
            <th className="px-4 py-3">{T("Guruh", "Группа", "Group")}</th>
            <th className="px-4 py-3 w-1/2">{T("Kirishlar", "Входы", "Entries")}</th>
          </tr>}>
            {topGroups.length === 0 ? (
              <EmptyRow colSpan={2} text={T("Bu davrda QR-kirishlar yo'q", "За этот период входов по QR нет", "No QR entries in this period")} />
            ) : topGroups.map(([name, n]) => (
              <tr key={name} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded bg-emerald-500" style={{ width: `${(n / maxGroup) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right text-xs font-semibold tabular-nums text-slate-700">{n}</span>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}
