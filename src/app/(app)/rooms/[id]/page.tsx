import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import { branchWhere } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import { Icon } from "../../_components/Icon";

const WD = ["", "Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const weekdayStr = (raw: string | null) =>
  raw ? raw.split(",").map(Number).filter((n) => n >= 1 && n <= 7).map((n) => WD[n]).join(", ") : "—";

const statusTone: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  PLANNED: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  FINISHED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  CANCELLED: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

export default async function RoomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.GROUPS)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsat yo'q.", ru: "Нет доступа к этому разделу.", en: "You do not have access to this section." })} />;
  }
  const { id } = await params;
  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) notFound();

  const [groups, branch] = await Promise.all([
    prisma.group.findMany({
      where: { AND: [{ room: room.name }, branchWhere(s)] }, // faol filial doirasida
      orderBy: { name: "asc" },
      include: {
        teacher: { select: { fullName: true } },
        program: { select: { name: true } },
        _count: { select: { students: true } },
      },
    }),
    room.branchId ? prisma.branch.findUnique({ where: { id: room.branchId }, select: { name: true } }) : Promise.resolve(null),
  ]);

  const totalStudents = groups.reduce((n, g) => n + g._count.students, 0);
  const activeGroups = groups.filter((g) => g.status === "ACTIVE").length;

  const L = (uz: string, ru: string, en: string) => tr(s.locale, { uz, ru, en });

  return (
    <div className="space-y-5">
      {/* Orqaga */}
      <Link href="/rooms" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300">
        <Icon name="arrow" className="h-4 w-4 rotate-180" /> {L("Xonalar", "Кабинеты", "Rooms")}
      </Link>

      {/* Xona sarlavhasi */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-500/15 text-brand-600 dark:text-brand-300"><Icon name="building" className="h-7 w-7" /></span>
          <div>
            <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{room.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1"><Icon name="users" className="h-4 w-4" /> {L("Sig'imi", "Вместимость", "Capacity")}: <b className="text-slate-700 dark:text-slate-200">{room.capacity || "—"}</b></span>
              {branch?.name && <span className="inline-flex items-center gap-1"><Icon name="building" className="h-4 w-4" /> {branch.name}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Ma'lumot kartalari */}
      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard icon="layers" tone="brand" value={groups.length} label={L("Guruhlar", "Группы", "Groups")} />
        <InfoCard icon="check" tone="green" value={activeGroups} label={L("Faol guruhlar", "Активные группы", "Active groups")} />
        <InfoCard icon="graduation" tone="violet" value={totalStudents} label={L("O'quvchilar", "Ученики", "Students")} />
      </div>

      {/* Izoh */}
      {room.note && room.note.trim() && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{L("Izoh", "Примечание", "Note")}</div>
          <p className="text-sm text-slate-700 dark:text-slate-200">{room.note}</p>
        </div>
      )}

      {/* Undagi guruhlar / jadval */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200/70 px-6 py-4 dark:border-slate-800">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-700 dark:text-slate-200"><Icon name="calendar" className="h-5 w-5 text-brand-500" /> {L("Xonadagi guruhlar va jadval", "Группы и расписание кабинета", "Groups and schedule in this room")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3.5">{L("Guruh", "Группа", "Group")}</th>
                <th className="px-6 py-3.5">{L("Kurs", "Курс", "Course")}</th>
                <th className="px-6 py-3.5">{L("Daraja", "Уровень", "Level")}</th>
                <th className="px-6 py-3.5">{L("Kun", "Дни", "Days")}</th>
                <th className="px-6 py-3.5">{L("Dars vaqti", "Время", "Time")}</th>
                <th className="px-6 py-3.5">{L("O'qituvchi", "Преподаватель", "Teacher")}</th>
                <th className="px-6 py-3.5">{L("O'quvchilar", "Ученики", "Students")}</th>
                <th className="px-6 py-3.5">{L("Holat", "Статус", "Status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {groups.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center text-slate-400">{L("Bu xonaga biriktirilgan guruhlar yo'q", "Нет групп, привязанных к этому кабинету", "No groups assigned to this room")}</td></tr>
              ) : groups.map((g) => (
                <tr key={g.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-6 py-4"><Link href={`/groups/${g.id}`} className="font-semibold text-slate-800 transition hover:text-brand-600 dark:text-slate-100 dark:hover:text-brand-300">{g.name}</Link></td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{g.program.name}</td>
                  <td className="px-6 py-4 text-slate-500">{g.levelCode ?? "—"}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{weekdayStr(g.weekdays)}</td>
                  <td className="px-6 py-4 text-slate-500">{g.startTime && g.endTime ? `${g.startTime}–${g.endTime}` : "—"}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{g.teacher?.fullName ?? "—"}</td>
                  <td className="px-6 py-4"><span className="inline-flex items-center gap-1 rounded-md bg-brand-500/15 px-2 py-0.5 text-xs font-bold text-brand-600 dark:text-brand-300"><Icon name="users" className="h-3.5 w-3.5" /> {g._count.students}/{g.capacity}</span></td>
                  <td className="px-6 py-4"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone[g.status] ?? statusTone.PLANNED}`}>{g.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const infoTone: Record<string, string> = {
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
  green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
};
function InfoCard({ icon, tone, value, label }: { icon: string; tone: string; value: number; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${infoTone[tone] ?? infoTone.brand}`}><Icon name={icon} className="h-5 w-5" /></div>
      <div><div className="text-2xl font-bold leading-none text-slate-900 dark:text-slate-100">{value}</div><div className="mt-1 text-xs text-slate-400">{label}</div></div>
    </div>
  );
}
