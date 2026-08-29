import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { branchViaLesson, branchViaStudent } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { PageHeader, Card, HubCard, StatCard, Table, EmptyRow, Badge, Forbidden } from "../_components/ui";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];

export default async function ControlPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim rahbariyat uchun.", ru: "Этот раздел для руководства.", en: "This section is for management.", de: "Dieser Bereich ist für die Geschäftsleitung." })} />;
  }

  // Barcha ko'rsatkichlar faol filial doirasida
  const [anomalies, unconfirmed, manualPayments, lowScores, recentAudit] = await Promise.all([
    prisma.attendance.findMany({
      where: { AND: [{ anomaly: true }, branchViaLesson(s)] },
      include: { student: true, lesson: { include: { group: true } } },
      take: 20,
      orderBy: { markedAt: "desc" },
    }),
    prisma.attendance.count({ where: { AND: [{ confirmed: false }, branchViaLesson(s)] } }),
    prisma.payment.count({ where: { AND: [{ isManual: true }, branchViaStudent(s)] } }),
    prisma.submission.count({ where: { AND: [{ score: { lt: 60 }, status: "GRADED" }, branchViaStudent(s)] } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: true } }),
  ]);

  return (
    <>
      <PageHeader title={tr(s.locale, { uz: "Nazorat", ru: "Контроль", en: "Control", de: "Kontrolle" })} subtitle={tr(s.locale, { uz: "Anomaliyalar, tasdiqlanmagan yozuvlar va audit", ru: "Аномалии, неподтверждённые записи и аудит", en: "Anomalies, unconfirmed records and audit", de: "Anomalien, unbestätigte Einträge und Audit" })} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={tr(s.locale, { uz: "QR anomaliyalar", ru: "QR аномалии", en: "QR anomalies", de: "QR-Anomalien" })} value={anomalies.length} tone={anomalies.length ? "red" : "green"} icon="eye" />
        <StatCard label={tr(s.locale, { uz: "Tasdiqlanmagan davomat", ru: "Неподтверждённая посещаемость", en: "Unconfirmed attendance", de: "Unbestätigte Anwesenheit" })} value={unconfirmed} tone={unconfirmed ? "amber" : "green"} icon="check" />
        <StatCard label={tr(s.locale, { uz: "Qo'lda to'lovlar", ru: "Ручные платежи", en: "Manual payments", de: "Manuelle Zahlungen" })} value={manualPayments} tone="amber" icon="card" />
        <StatCard label={tr(s.locale, { uz: "Past baholar (<60)", ru: "Низкие оценки (<60)", en: "Low scores (<60)", de: "Niedrige Bewertungen (<60)" })} value={lowScores} icon="pencil" />
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <HubCard href="/audit" icon="history" title={tr(s.locale, { uz: "Audit jurnali", ru: "Журнал аудита", en: "Audit log", de: "Auditprotokoll" })} desc={tr(s.locale, { uz: "Barcha muhim amallar tarixi (o'chirilmaydi)", ru: "История всех важных действий (не удаляется)", en: "History of all important actions (not deletable)", de: "Verlauf aller wichtigen Aktionen (nicht löschbar)" })} />
        <HubCard href="/attendance" icon="check" title={tr(s.locale, { uz: "Davomat nazorati", ru: "Контроль посещаемости", en: "Attendance control", de: "Anwesenheitskontrolle" })} desc={tr(s.locale, { uz: "Darslar va QR-davomat holati", ru: "Уроки и статус QR-посещаемости", en: "Lessons and QR attendance status", de: "Unterricht und QR-Anwesenheitsstatus" })} />
        <HubCard href="/payments" icon="card" title={tr(s.locale, { uz: "To'lov nazorati", ru: "Контроль платежей", en: "Payment control", de: "Zahlungskontrolle" })} desc={tr(s.locale, { uz: "Qo'lda kiritilgan va bekor qilingan to'lovlar", ru: "Введённые вручную и отменённые платежи", en: "Manually entered and cancelled payments", de: "Manuell eingegebene und stornierte Zahlungen" })} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card padded={false}>
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-700">{tr(s.locale, { uz: "QR-davomat anomaliyalari", ru: "Аномалии QR-посещаемости", en: "QR attendance anomalies", de: "QR-Anwesenheitsanomalien" })}</h3>
          </div>
          <Table
            head={
              <tr>
                <th className="px-4 py-3">{tr(s.locale, { uz: "O'quvchi", ru: "Ученик", en: "Student", de: "Schüler" })}</th>
                <th className="px-4 py-3">{tr(s.locale, { uz: "Guruh", ru: "Группа", en: "Group", de: "Gruppe" })}</th>
                <th className="px-4 py-3">{tr(s.locale, { uz: "Sana", ru: "Дата", en: "Date", de: "Datum" })}</th>
              </tr>
            }
          >
            {anomalies.length === 0 ? (
              <EmptyRow colSpan={3} text={tr(s.locale, { uz: "Anomaliya yo'q ✅", ru: "Аномалий нет ✅", en: "No anomalies ✅", de: "Keine Anomalien ✅" })} />
            ) : (
              anomalies.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{a.student.fullName}</td>
                  <td className="px-4 py-3 text-slate-600">{a.lesson.group.name}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Intl.DateTimeFormat(s.locale === "ru" ? "ru-RU" : "uz-UZ", { dateStyle: "short", timeStyle: "short" }).format(a.markedAt)}
                  </td>
                </tr>
              ))
            )}
          </Table>
        </Card>

        <Card padded={false}>
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-700">{tr(s.locale, { uz: "Oxirgi amallar (audit)", ru: "Последние действия (аудит)", en: "Recent actions (audit)", de: "Letzte Aktionen (Audit)" })}</h3>
          </div>
          <Table
            head={
              <tr>
                <th className="px-4 py-3">{tr(s.locale, { uz: "Muallif", ru: "Автор", en: "Author", de: "Autor" })}</th>
                <th className="px-4 py-3">{tr(s.locale, { uz: "Amal", ru: "Действие", en: "Action", de: "Aktion" })}</th>
                <th className="px-4 py-3">{tr(s.locale, { uz: "Obyekt", ru: "Объект", en: "Object", de: "Objekt" })}</th>
              </tr>
            }
          >
            {recentAudit.length === 0 ? (
              <EmptyRow colSpan={3} text={tr(s.locale, { uz: "Yozuv yo'q", ru: "Нет записей", en: "No records", de: "Keine Einträge" })} />
            ) : (
              recentAudit.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{l.actor?.fullName ?? "—"}</td>
                  <td className="px-4 py-3"><Badge tone={l.action === "CANCEL" ? "red" : l.action === "CREATE" ? "green" : "amber"}>{l.action}</Badge></td>
                  <td className="px-4 py-3 text-slate-500">{l.entityType}</td>
                </tr>
              ))
            )}
          </Table>
        </Card>
      </div>
    </>
  );
}
