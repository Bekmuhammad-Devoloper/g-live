import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import { Icon } from "../../_components/Icon";
import AttendanceExport from "./AttendanceExport";
import AttendanceCharts from "./AttendanceCharts";
import type { Prisma } from "@prisma/client";

const PRESENT = ["PRESENT", "LATE", "ONLINE", "MAKEUP"];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const p2 = (n: number) => String(n).padStart(2, "0");
const isoLocal = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// Davomat holatlari — ranglar validatordan o'tgan (ΔE≥8, ko'rinadigan yorliqlar bilan)
const STATUS_META = [
  { key: "PRESENT", color: "#10b981", uz: "Keldi", ru: "Присутствовал", en: "Present" },
  { key: "LATE", color: "#f59e0b", uz: "Kechikdi", ru: "Опоздал", en: "Late" },
  { key: "ABSENT", color: "#ef4444", uz: "Kelmadi", ru: "Отсутствовал", en: "Absent" },
  { key: "EXCUSED", color: "#3b82f6", uz: "Uzrli", ru: "Уважительная", en: "Excused" },
  { key: "ONLINE", color: "#06b6d4", uz: "Onlayn", ru: "Онлайн", en: "Online" },
  { key: "MAKEUP", color: "#8b5cf6", uz: "Qoplama", ru: "Отработка", en: "Makeup" },
];

export default async function AttendanceReportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.REPORTS)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsat yo'q.", ru: "Нет доступа к этому разделу.", en: "You don't have access to this section." })} />;
  }
  const sp = await searchParams;

  const today = new Date();
  const def30 = new Date(today); def30.setDate(today.getDate() - 29); // standart: oxirgi 30 kun
  const fromStr = sp.from || isoLocal(def30);
  const toStr = sp.to || isoLocal(today);
  const from = new Date(fromStr + "T00:00:00");
  const to = new Date(toStr + "T23:59:59");
  const branchId = sp.branchId || "";
  const groupId = sp.groupId || "";

  const [branches, groups] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.group.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, ...(branchId ? { where: { branchId } } : {}) }),
  ]);

  const attWhere: Prisma.AttendanceWhereInput = {
    markedAt: { gte: from, lte: to },
    ...(groupId ? { lesson: { groupId } } : {}),
    ...(branchId ? { student: { branchId } } : {}),
  };
  const studentWhere: Prisma.StudentWhereInput = {
    ...(branchId ? { branchId } : {}),
    ...(groupId ? { enrollments: { some: { groupId } } } : {}),
  };

  const [recs, total] = await Promise.all([
    prisma.attendance.findMany({ where: attWhere, select: { studentId: true, status: true, markedAt: true } }),
    prisma.student.count({ where: studentWhere }),
  ]);

  const byStudent = new Map<string, { present: number; absent: number }>();
  const statusCounts: Record<string, number> = {};
  const dailyMap = new Map<string, { present: number; absent: number }>();
  let totalPresent = 0, totalAbsent = 0;
  for (const r of recs) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
    const isP = PRESENT.includes(r.status);
    const isA = r.status === "ABSENT";
    const e = byStudent.get(r.studentId) ?? { present: 0, absent: 0 };
    if (isP) e.present++;
    if (isA) e.absent++;
    byStudent.set(r.studentId, e);
    const day = isoLocal(r.markedAt);
    const d = dailyMap.get(day) ?? { present: 0, absent: 0 };
    if (isP) { d.present++; totalPresent++; }
    if (isA) { d.absent++; totalAbsent++; }
    dailyMap.set(day, d);
  }
  const vals = [...byStudent.values()];
  const kelgan = vals.filter((e) => e.present >= 1).length;
  const kelmagan = vals.filter((e) => e.absent >= 2).length;
  const bosh = Math.max(0, total - byStudent.size);

  // Grafiklar uchun: o'quvchilar taqsimoti (mutlaq bo'linma), foiz, kunlik qator
  const attended = vals.filter((e) => e.present >= 1).length;
  const absentOnly = vals.filter((e) => e.present === 0 && e.absent >= 1).length;
  const rate = totalPresent + totalAbsent > 0 ? Math.round((totalPresent / (totalPresent + totalAbsent)) * 100) : 0;
  const statuses = STATUS_META.map((m) => ({ key: m.key, label: tr(s.locale, { uz: m.uz, ru: m.ru, en: m.en }), count: statusCounts[m.key] ?? 0, color: m.color }));

  const dayList: { date: string; present: number; absent: number }[] = [];
  {
    const cur = new Date(fromStr + "T00:00:00");
    const end = new Date(toStr + "T00:00:00");
    let guard = 0;
    while (cur <= end && guard < 180) {
      const key = isoLocal(cur);
      const v = dailyMap.get(key) ?? { present: 0, absent: 0 };
      dayList.push({ date: key, present: v.present, absent: v.absent });
      cur.setDate(cur.getDate() + 1);
      guard++;
    }
  }

  const rows = [
    { label: tr(s.locale, { uz: "Kelgan talabalar (eng kami bir marta)", ru: "Присутствовавшие ученики (хотя бы раз)", en: "Attended students (at least once)" }), value: kelgan },
    { label: tr(s.locale, { uz: "Kelmagan (bir martadan ko'p)", ru: "Отсутствовавшие (более одного раза)", en: "Absent (more than once)" }), value: kelmagan },
    { label: tr(s.locale, { uz: "Davomat bo'sh", ru: "Посещаемость пуста", en: "No attendance" }), value: bosh },
    { label: tr(s.locale, { uz: "Barchasi", ru: "Все", en: "All" }), value: total, total: true },
  ];

  const sel = "h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm text-slate-700 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
  const dateInp = "h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(s.locale, { uz: "Davomat hisobotlari", ru: "Отчёты по посещаемости", en: "Attendance reports" })}</h1>
        <AttendanceExport rows={rows.map((r) => ({ label: r.label, value: r.value }))} locale={s.locale} />
      </div>

      <AttendanceCharts
        locale={s.locale}
        total={total}
        attended={attended}
        absentOnly={absentOnly}
        bosh={bosh}
        rate={rate}
        totalPresent={totalPresent}
        totalAbsent={totalAbsent}
        statuses={statuses}
        daily={dayList}
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Chap: jamlanma jadval (batafsil) */}
        <div className="flex-1">
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.label} className={r.total ? "bg-brand-50/60 dark:bg-brand-500/10" : ""}>
                    <td className="px-5 py-4 font-medium text-slate-600 dark:text-slate-300">{r.label}</td>
                    <td className="w-32 px-5 py-4 text-lg font-bold text-slate-800 dark:text-slate-100">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* O'ng: filtr paneli */}
        <form method="GET" className="w-full shrink-0 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 lg:w-80">
          <h3 className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-200">{tr(s.locale, { uz: "Filtr", ru: "Фильтр", en: "Filter" })}</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-slate-500 dark:text-slate-400">{tr(s.locale, { uz: "Sanadan boshlab", ru: "С даты", en: "From date" })}</label>
              <div className="relative">
                <Icon name="calendar" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="date" name="from" defaultValue={fromStr} className={dateInp} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-500 dark:text-slate-400">{tr(s.locale, { uz: "Sana bo'yicha", ru: "По дату", en: "To date" })}</label>
              <div className="relative">
                <Icon name="calendar" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="date" name="to" defaultValue={toStr} className={dateInp} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-500 dark:text-slate-400">{tr(s.locale, { uz: "Filiallar", ru: "Филиалы", en: "Branches" })}</label>
              <div className="relative">
                <select name="branchId" defaultValue={branchId} className={sel}>
                  <option value="">{tr(s.locale, { uz: "Barchasi", ru: "Все", en: "All" })}</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <Icon name="chevronDown" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-500 dark:text-slate-400">{tr(s.locale, { uz: "Guruh", ru: "Группа", en: "Group" })}</label>
              <div className="relative">
                <select name="groupId" defaultValue={groupId} className={sel}>
                  <option value="">{tr(s.locale, { uz: "Select", ru: "Выбрать", en: "Select" })}</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <Icon name="chevronDown" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Link href="/reports/attendance" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">{tr(s.locale, { uz: "Tozalash", ru: "Очистить", en: "Clear" })}</Link>
              <button type="submit" className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">{tr(s.locale, { uz: "Filtr", ru: "Фильтр", en: "Filter" })}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
