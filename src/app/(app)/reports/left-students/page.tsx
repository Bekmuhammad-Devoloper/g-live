import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { branchWhere, branchViaGroup } from "@/lib/branchScope";
import { Forbidden } from "../../_components/ui";
import { Icon } from "../../_components/Icon";
import LeftExport from "./LeftExport";
import type { Prisma } from "@prisma/client";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const p2 = (n: number) => String(n).padStart(2, "0");
const dstr = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
const MONTHS_BY_LOCALE: Record<Locale, string[]> = {
  uz: ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"],
  ru: ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  de: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
};
const STATUS_OPTS: { v: string; label: { uz: string; ru: string; en: string; de: string } }[] = [
  { v: "WAITING", label: { uz: "Sinov darsida", ru: "На пробном уроке", en: "In trial lesson", de: "In der Probestunde" } },
  { v: "ACTIVE", label: { uz: "Faol", ru: "Активный", en: "Active", de: "Aktiv" } },
  { v: "FROZEN", label: { uz: "Muzlatilgan", ru: "Заморожен", en: "Frozen", de: "Pausiert" } },
];

export default async function LeftStudentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.REPORTS)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsat yo'q.", ru: "Нет доступа к этому разделу.", en: "You don't have access to this section.", de: "Sie haben keinen Zugriff auf diesen Bereich." })} />;
  }
  const sp = await searchParams;
  const MONTHS = MONTHS_BY_LOCALE[s.locale];

  const now = new Date();
  const fromStr = sp.from || iso(new Date(now.getFullYear(), now.getMonth(), 1));
  const toStr = sp.to || iso(now);
  const from = new Date(fromStr + "T00:00:00");
  const to = new Date(toStr + "T23:59:59");
  const courseId = sp.courseId || "";
  const teacherId = sp.teacherId || "";
  const status = sp.status || "";

  const [programs, teachers] = await Promise.all([
    prisma.program.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    // faol filial doirasida
    prisma.user.findMany({ where: { AND: [{ role: "TEACHER" }, branchWhere(s)] }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  ]);

  // Guruhni tark etgan = GroupStudent isActive=false
  const where: Prisma.GroupStudentWhereInput = {
    AND: [
      {
        isActive: false,
        joinedAt: { gte: from, lte: to },
        ...(courseId || teacherId ? { group: { ...(courseId ? { programId: courseId } : {}), ...(teacherId ? { teacherId } : {}) } } : {}),
        ...(status ? { student: { eduStatus: status } } : {}),
      },
      branchViaGroup(s), // faol filial doirasida
    ],
  };
  const left = await prisma.groupStudent.findMany({
    where,
    orderBy: { joinedAt: "desc" },
    include: {
      student: { select: { fullName: true, phone: true } },
      group: { include: { teacher: { select: { fullName: true } }, program: { select: { name: true } } } },
    },
  });

  const exportRowsData = left.map((x) => ({
    name: x.student?.fullName ?? "—",
    phone: x.student?.phone ?? "",
    group: x.group.name ?? "",
    teacher: x.group.teacher?.fullName ?? "",
    course: x.group.program?.name ?? "",
    date: dstr(x.joinedAt),
  }));

  const tally = (keyFn: (x: (typeof left)[number]) => string | null) => {
    const m = new Map<string, number>();
    for (const x of left) { const k = keyFn(x); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 12);
  };
  const byTeacher = tally((x) => x.group.teacher?.fullName ?? null);
  const byCourse = tally((x) => x.group.program?.name ?? null);
  const byMonth = tally((x) => `${MONTHS[x.joinedAt.getMonth()]} ${x.joinedAt.getFullYear()}`);
  const byReason: { label: string; value: number }[] = [];

  const sel = "h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm text-slate-600 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
  const dateInp = "h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(s.locale, { uz: "Guruhni tark etgan o'quvchilar", ru: "Ученики, покинувшие группу", en: "Students who left the group", de: "Schüler, die die Gruppe verlassen haben" })}</h1>
        <span className="text-sm text-slate-400">{tr(s.locale, { uz: "Miqdor", ru: "Количество", en: "Count", de: "Anzahl" })} — {left.length}</span>
        <div className="ml-auto"><LeftExport rows={exportRowsData} locale={s.locale} /></div>
      </div>

      {/* Filtr */}
      <form method="GET" className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="relative">
            <Icon name="calendar" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="date" name="from" defaultValue={fromStr} className={dateInp} />
          </div>
          <div className="relative">
            <Icon name="calendar" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="date" name="to" defaultValue={toStr} className={dateInp} />
          </div>
          <Select name="courseId" value={courseId} placeholder={tr(s.locale, { uz: "Kurs", ru: "Курс", en: "Course", de: "Kurs" })} options={programs.map((p) => ({ v: p.id, label: p.name }))} cls={sel} />
          <Select name="teacherId" value={teacherId} placeholder={tr(s.locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher", de: "Lehrer" })} options={teachers.map((tt) => ({ v: tt.id, label: tt.fullName }))} cls={sel} />
          <Select name="reason" value={sp.reason || ""} placeholder={tr(s.locale, { uz: "Arxivlash sabablari", ru: "Причины архивации", en: "Archiving reasons", de: "Archivierungsgründe" })} options={[]} cls={sel} />
          <Select name="status" value={status} placeholder={tr(s.locale, { uz: "Holati", ru: "Статус", en: "Status", de: "Status" })} options={STATUS_OPTS.map((o) => ({ v: o.v, label: tr(s.locale, o.label) }))} cls={sel} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button type="submit" className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">{tr(s.locale, { uz: "Filtr", ru: "Фильтр", en: "Filter", de: "Filter" })}</button>
          <Link href="/reports/left-students" className="flex h-9 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700" title={tr(s.locale, { uz: "Tozalash", ru: "Очистить", en: "Clear", de: "Zurücksetzen" })}><Icon name="refresh" className="h-4 w-4" /></Link>
        </div>
      </form>

      {/* Diagrammalar */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Chart title={tr(s.locale, { uz: "Ustoz kesimida", ru: "По преподавателям", en: "By teacher", de: "Nach Lehrer" })} data={byTeacher} />
        <Chart title={tr(s.locale, { uz: "Kurs kesimida", ru: "По курсам", en: "By course", de: "Nach Kurs" })} data={byCourse} />
        <Chart title={tr(s.locale, { uz: "Oylik kesimida", ru: "По месяцам", en: "By month", de: "Nach Monat" })} data={byMonth} />
        <Chart title={tr(s.locale, { uz: "Sabab kesimida", ru: "По причинам", en: "By reason", de: "Nach Grund" })} data={byReason} />
      </div>
    </div>
  );
}

function Select({ name, value, placeholder, options, cls }: { name: string; value: string; placeholder: string; options: { v: string; label: string }[]; cls: string }) {
  return (
    <div className="relative">
      <select name={name} defaultValue={value} className={cls}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
      <Icon name="chevronDown" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

function Chart({ title, data }: { title: string; data: { label: string; value: number }[] }) {
  const W = 560, H = 300, padL = 34, padB = 56, padT = 12, padR = 12;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const bw = n > 0 ? Math.min(56, (plotW / n) * 0.55) : 0;
  return (
    <div>
      <h3 className="mb-2 text-base font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      <div className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[240px] w-full">
          <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
          <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
          <text x={padL - 8} y={padT + plotH + 4} textAnchor="end" fontSize="12" className="fill-slate-400">0</text>
          <text x={padL - 8} y={padT + 10} textAnchor="end" fontSize="12" className="fill-slate-400">{max}</text>
          {data.map((d, i) => {
            const cx = padL + (plotW / n) * (i + 0.5);
            const h = (d.value / max) * plotH;
            return (
              <g key={i}>
                <rect x={cx - bw / 2} y={padT + plotH - h} width={bw} height={h} rx="3" fill="#3b82f6" />
                <text x={cx} y={padT + plotH - h - 5} textAnchor="middle" fontSize="11" fontWeight="700" className="fill-slate-700 dark:fill-slate-200">{d.value}</text>
                <text x={cx} y={padT + plotH + 16} textAnchor="middle" fontSize="10" className="fill-slate-500">{d.label.length > 12 ? d.label.slice(0, 11) + "…" : d.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
