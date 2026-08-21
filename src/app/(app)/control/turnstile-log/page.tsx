import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { PageHeader, Card, Table, EmptyRow, Badge, Forbidden } from "../../_components/ui";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];

// Turniket kirish-chiqish jurnali — QR orqali belgilangan kirishlar xronologiyasi
export default async function TurnstileLogPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim rahbariyat uchun.", ru: "Этот раздел для руководства.", en: "This section is for management." })} />;
  }
  const T = (uz: string, ru: string, en: string) => tr(s.locale, { uz, ru, en });

  const rows = await prisma.attendance.findMany({
    where: { method: "QR" },
    orderBy: { markedAt: "desc" },
    take: 100,
    select: {
      id: true, status: true, anomaly: true, markedAt: true,
      student: { select: { fullName: true } },
      lesson: { select: { startsAt: true, group: { select: { name: true } } } },
    },
  });

  const fmt = new Intl.DateTimeFormat(s.locale === "ru" ? "ru-RU" : "uz-UZ", { dateStyle: "short", timeStyle: "medium" });

  return (
    <>
      <PageHeader title={T("Turniket kirish-chiqish analitikasi", "Аналитика входов-выходов турникета", "Turnstile in/out log")} subtitle={T("QR skanerlash orqali kirishlar jurnali (oxirgi 100 ta)", "Журнал входов по сканированию QR (последние 100)", "Log of QR scan entries (latest 100)")} />

      <Card padded={false}>
        <Table head={<tr>
          <th className="px-4 py-3">{T("Vaqt", "Время", "Time")}</th>
          <th className="px-4 py-3">{T("O'quvchi", "Ученик", "Student")}</th>
          <th className="px-4 py-3">{T("Guruh", "Группа", "Group")}</th>
          <th className="px-4 py-3">{T("Holat", "Статус", "Status")}</th>
          <th className="px-4 py-3">{T("Belgi", "Отметка", "Flag")}</th>
        </tr>}>
          {rows.length === 0 ? (
            <EmptyRow colSpan={5} text={T("QR orqali kirishlar hali yo'q", "Входов по QR пока нет", "No QR entries yet")} />
          ) : rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">{fmt.format(r.markedAt)}</td>
              <td className="px-4 py-3 font-medium text-slate-800">{r.student.fullName}</td>
              <td className="px-4 py-3 text-slate-600">{r.lesson.group.name}</td>
              <td className="px-4 py-3"><Badge tone={r.status === "PRESENT" ? "green" : r.status === "LATE" ? "amber" : "red"}>{r.status}</Badge></td>
              <td className="px-4 py-3">
                {r.anomaly
                  ? <Badge tone="red">{T("Anomaliya", "Аномалия", "Anomaly")}</Badge>
                  : <span className="text-xs text-slate-400">{T("Toza", "Чисто", "Clean")}</span>}
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
