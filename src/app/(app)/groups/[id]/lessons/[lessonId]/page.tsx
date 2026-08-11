import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPermission, MODULES } from "@/lib/rbac";
import { ROLES, ATTENDANCE_STATUS_LABELS, label } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { PageHeader, Card, Table, Badge, Forbidden } from "../../../../_components/ui";
import { GenerateQrButton, AttendanceControls, ConfirmButton } from "./LessonControls";

export default async function LessonPage({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const { id, lessonId } = await params;
  const s = await requireSession();

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      group: { include: { teacher: true, students: { include: { student: true }, orderBy: { joinedAt: "asc" } } } },
      attendances: true,
    },
  });
  if (!lesson || lesson.groupId !== id) notFound();

  const full = getPermission(s.role, MODULES.ATTENDANCE) === "FULL";
  const isOwnerTeacher = s.role === ROLES.TEACHER && lesson.group.teacherId === s.userId;
  const canManage = full || isOwnerTeacher;
  const canView = canManage || [ROLES.DIRECTOR, ROLES.ADMIN, ROLES.MANAGER].includes(s.role as never);
  if (!canView) return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu darsga kirish huquqingiz yo'q.", ru: "У вас нет прав доступа к этому уроку.", en: "You do not have access to this lesson." })} />;

  const attMap = new Map(lesson.attendances.map((a) => [a.studentId, a]));
  const qrActive = !!lesson.qrToken && !!lesson.qrExpiresAt && lesson.qrExpiresAt.getTime() > Date.now();

  let qrSvg = "";
  let checkinUrl = "";
  if (qrActive && lesson.qrToken) {
    const host = (await headers()).get("host") ?? "localhost:3000";
    const proto = process.env.NODE_ENV === "production" ? "https" : "http";
    checkinUrl = `${proto}://${host}/checkin/${lesson.qrToken}`;
    qrSvg = await QRCode.toString(checkinUrl, { type: "svg", margin: 1, width: 200 });
  }

  const fmt = (d: Date) => new Intl.DateTimeFormat(s.locale === "ru" ? "ru-RU" : "uz-UZ", { dateStyle: "medium", timeStyle: "short" }).format(d);

  return (
    <>
      <div className="mb-4">
        <Link href={`/groups/${id}`} className="text-sm text-brand-600 hover:underline">← {lesson.group.name}</Link>
      </div>
      <PageHeader title={lesson.topic ?? tr(s.locale, { uz: "Dars", ru: "Урок", en: "Lesson" })} subtitle={fmt(lesson.startsAt)} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* QR panel */}
        {canManage && (
          <Card className="lg:col-span-1">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">{tr(s.locale, { uz: "QR-davomat", ru: "QR-посещаемость", en: "QR attendance" })}</h3>
            {qrActive ? (
              <div className="space-y-3 text-center">
                <div className="mx-auto inline-block rounded-lg border border-slate-200 p-2" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                <p className="text-xs text-slate-400">
                  {tr(s.locale, { uz: "Amal muddati", ru: "Срок действия", en: "Valid until" })}: {lesson.qrExpiresAt ? fmt(lesson.qrExpiresAt) : "—"}
                </p>
                <Link href={`/checkin/${lesson.qrToken}`} className="block text-xs text-brand-600 hover:underline">
                  {tr(s.locale, { uz: "Check-in havolasi (sinash uchun)", ru: "Ссылка для отметки (для проверки)", en: "Check-in link (for testing)" })}
                </Link>
                <GenerateQrButton lessonId={lesson.id} hasQr={true} locale={s.locale} />
              </div>
            ) : (
              <div className="space-y-3 text-center">
                <p className="text-sm text-slate-400">{tr(s.locale, { uz: "QR hali yaratilmagan yoki muddati tugagan.", ru: "QR ещё не создан или срок его действия истёк.", en: "QR not yet generated or has expired." })}</p>
                <GenerateQrButton lessonId={lesson.id} hasQr={false} locale={s.locale} />
              </div>
            )}
          </Card>
        )}

        {/* Davomat ro'yxati */}
        <Card className={canManage ? "lg:col-span-2" : "lg:col-span-3"}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">{tr(s.locale, { uz: "Davomat", ru: "Посещаемость", en: "Attendance" })} ({lesson.group.students.length})</h3>
            {canManage && lesson.attendances.length > 0 && <ConfirmButton lessonId={lesson.id} locale={s.locale} />}
          </div>
          <Table
            head={
              <tr>
                <th className="px-3 py-2">{tr(s.locale, { uz: "O'quvchi", ru: "Ученик", en: "Student" })}</th>
                <th className="px-3 py-2">{tr(s.locale, { uz: "Holat", ru: "Статус", en: "Status" })}</th>
                {canManage && <th className="px-3 py-2">{tr(s.locale, { uz: "Belgilash", ru: "Отметить", en: "Mark" })}</th>}
              </tr>
            }
          >
            {lesson.group.students.map((gs) => {
              const a = attMap.get(gs.studentId);
              return (
                <tr key={gs.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">
                    {gs.student.fullName}
                    {a?.anomaly && <Badge tone="amber">{tr(s.locale, { uz: "anomaliya", ru: "аномалия", en: "anomaly" })}</Badge>}
                  </td>
                  <td className="px-3 py-2">
                    {a ? (
                      <span className="flex items-center gap-1.5">
                        <Badge tone={a.status === "ABSENT" ? "red" : "green"}>{label(ATTENDANCE_STATUS_LABELS, a.status, s.locale)}</Badge>
                        {a.method === "QR" && <span className="text-[10px] text-slate-400">QR</span>}
                        {a.confirmed && <span className="text-[10px] text-emerald-600">✓</span>}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-3 py-2">
                      <AttendanceControls lessonId={lesson.id} studentId={gs.studentId} current={a?.status ?? null} locale={s.locale} />
                    </td>
                  )}
                </tr>
              );
            })}
          </Table>
        </Card>
      </div>
    </>
  );
}
