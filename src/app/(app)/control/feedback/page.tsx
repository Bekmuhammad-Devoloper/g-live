import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { PageHeader, Card, StatCard, Table, EmptyRow, Forbidden } from "../../_components/ui";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];

// Fikr-mulohaza — o'qituvchilar haqidagi baho va izohlar (Feedback modeli)
export default async function FeedbackPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim rahbariyat uchun.", ru: "Этот раздел для руководства.", en: "This section is for management." })} />;
  }
  const T = (uz: string, ru: string, en: string) => tr(s.locale, { uz, ru, en });

  const [items, perTeacher] = await Promise.all([
    prisma.feedback.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.feedback.groupBy({ by: ["teacherId"], _avg: { rating: true }, _count: { _all: true } }),
  ]);

  const teacherIds = Array.from(new Set([...items.map((f) => f.teacherId), ...perTeacher.map((p) => p.teacherId)]));
  const studentIds = Array.from(new Set(items.map((f) => f.studentId).filter(Boolean))) as string[];
  const groupIds = Array.from(new Set(items.map((f) => f.groupId).filter(Boolean))) as string[];
  const [teachers, students, groups] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: teacherIds } }, select: { id: true, fullName: true } }),
    studentIds.length ? prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, fullName: true } }) : Promise.resolve([]),
    groupIds.length ? prisma.group.findMany({ where: { id: { in: groupIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const tName = new Map(teachers.map((t) => [t.id, t.fullName]));
  const stName = new Map(students.map((x) => [x.id, x.fullName]));
  const gName = new Map(groups.map((g) => [g.id, g.name]));

  const total = perTeacher.reduce((a, p) => a + p._count._all, 0);
  const avgAll = total ? perTeacher.reduce((a, p) => a + (p._avg.rating ?? 0) * p._count._all, 0) / total : 0;
  const low = items.filter((f) => f.rating <= 2).length;
  const fmt = new Intl.DateTimeFormat(s.locale === "ru" ? "ru-RU" : "uz-UZ", { dateStyle: "short", timeStyle: "short" });
  const stars = (n: number) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));

  return (
    <>
      <PageHeader title={T("Fikr-mulohaza", "Отзывы", "Feedback")} subtitle={T("O'qituvchilar haqidagi baho va izohlar", "Оценки и отзывы о преподавателях", "Ratings and comments about teachers")} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label={T("Jami fikrlar", "Всего отзывов", "Total feedback")} value={total} icon="info" />
        <StatCard label={T("O'rtacha baho", "Средняя оценка", "Average rating")} value={total ? avgAll.toFixed(1) : "—"} tone={avgAll >= 4 ? "green" : avgAll >= 3 ? "amber" : "red"} icon="trophy" />
        <StatCard label={T("Past baho (1–2)", "Низкие (1–2)", "Low (1–2)")} value={low} tone={low ? "red" : "green"} icon="eye" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card padded={false}>
          <div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-semibold text-slate-700">{T("So'nggi fikrlar", "Последние отзывы", "Recent feedback")}</h3></div>
          <Table head={<tr>
            <th className="px-4 py-3">{T("O'qituvchi", "Преподаватель", "Teacher")}</th>
            <th className="px-4 py-3">{T("Baho", "Оценка", "Rating")}</th>
            <th className="px-4 py-3">{T("Izoh", "Комментарий", "Comment")}</th>
            <th className="px-4 py-3">{T("Kimdan / guruh", "От кого / группа", "From / group")}</th>
            <th className="px-4 py-3">{T("Sana", "Дата", "Date")}</th>
          </tr>}>
            {items.length === 0 ? (
              <EmptyRow colSpan={5} text={T("Hozircha fikr-mulohaza yo'q", "Отзывов пока нет", "No feedback yet")} />
            ) : items.map((f) => (
              <tr key={f.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{tName.get(f.teacherId) ?? "—"}</td>
                <td className={"whitespace-nowrap px-4 py-3 " + (f.rating >= 4 ? "text-emerald-600" : f.rating >= 3 ? "text-amber-500" : "text-rose-500")}>{stars(f.rating)}</td>
                <td className="max-w-[340px] px-4 py-3 text-slate-600"><span className="line-clamp-2">{f.comment || "—"}</span></td>
                <td className="px-4 py-3 text-slate-500">{[f.studentId ? stName.get(f.studentId) : null, f.groupId ? gName.get(f.groupId) : null].filter(Boolean).join(" · ") || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmt.format(f.createdAt)}</td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card padded={false}>
          <div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-semibold text-slate-700">{T("O'qituvchilar reytingi", "Рейтинг преподавателей", "Teacher ratings")}</h3></div>
          <Table head={<tr>
            <th className="px-4 py-3">{T("O'qituvchi", "Преподаватель", "Teacher")}</th>
            <th className="px-4 py-3 text-center">{T("Fikrlar", "Отзывы", "Count")}</th>
            <th className="px-4 py-3 text-right">{T("O'rtacha", "Средняя", "Avg")}</th>
          </tr>}>
            {perTeacher.length === 0 ? (
              <EmptyRow colSpan={3} text={T("Hozircha ma'lumot yo'q", "Пока нет данных", "No data yet")} />
            ) : [...perTeacher].sort((a, b) => (b._avg.rating ?? 0) - (a._avg.rating ?? 0)).map((p) => (
              <tr key={p.teacherId} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{tName.get(p.teacherId) ?? "—"}</td>
                <td className="px-4 py-3 text-center text-slate-600">{p._count._all}</td>
                <td className={"px-4 py-3 text-right font-semibold " + ((p._avg.rating ?? 0) >= 4 ? "text-emerald-600" : (p._avg.rating ?? 0) >= 3 ? "text-amber-500" : "text-rose-500")}>{(p._avg.rating ?? 0).toFixed(1)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}
