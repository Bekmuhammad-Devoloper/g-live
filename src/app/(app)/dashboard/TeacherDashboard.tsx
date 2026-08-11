import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { StatCard } from "../_components/ui";
import { Icon } from "../_components/Icon";
import { groupColor } from "../groups/groupColor";

const WD: Record<Locale, string[]> = {
  uz: ["", "Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"],
  ru: ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
  en: ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};
const toMin = (t: string | null) => { if (!t) return null; const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
const daysLabel = (wd: string | null, locale: Locale) => (wd ?? "").split(",").filter(Boolean).map((d) => WD[locale][+d]).join(", ");

export default async function TeacherDashboard({ userId, locale }: { userId: string; locale: Locale }) {
  const now = new Date();
  const jsDay = now.getDay();
  const todayWd = jsDay === 0 ? 7 : jsDay; // 1=Du..7=Ya
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [groups, user, monthLessons, curSalary] = await Promise.all([
    prisma.group.findMany({
      where: { teacherId: userId, status: { not: "CANCELLED" } },
      include: { program: { select: { name: true } }, _count: { select: { students: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { fiksa: true, kpiBonus: true } }),
    prisma.lesson.count({ where: { group: { teacherId: userId }, startsAt: { gte: monthStart, lt: monthEnd } } }),
    prisma.teacherSalary.findUnique({ where: { teacherId_year_month: { teacherId: userId, year: now.getFullYear(), month: now.getMonth() + 1 } } }),
  ]);

  const totalStudents = groups.reduce((n, g) => n + g._count.students, 0);
  const weekLessons = groups.reduce((n, g) => n + (g.weekdays ? g.weekdays.split(",").filter(Boolean).length : 0), 0);

  const todayGroups = groups
    .filter((g) => (g.weekdays ?? "").split(",").map(Number).includes(todayWd))
    .sort((a, b) => (toMin(a.startTime) ?? 0) - (toMin(b.startTime) ?? 0));

  const salary = (user?.fiksa ?? 0) + (user?.kpiBonus ?? 0) + (curSalary?.bonus ?? 0) - (curSalary?.penalty ?? 0);

  return (
    <div className="space-y-5">
      {/* KPI kartalar */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label={tr(locale, { uz: "Mening guruhlarim", ru: "Мои группы", en: "My groups" })} value={groups.length} tone="brand" icon="layers" />
        <StatCard label={tr(locale, { uz: "Jami o'quvchilar", ru: "Всего учеников", en: "Total students" })} value={totalStudents} tone="green" icon="graduation" />
        <StatCard label={tr(locale, { uz: "Bugungi darslar", ru: "Занятия сегодня", en: "Today's lessons" })} value={todayGroups.length} icon="calendar" />
        <StatCard label={tr(locale, { uz: "Haftalik darslar", ru: "Занятий в неделю", en: "Weekly lessons" })} value={weekLessons} tone="amber" icon="clock" />
        <StatCard label={tr(locale, { uz: "Oylik maosh", ru: "Месячная зарплата", en: "Monthly salary" })} value={formatMoney(salary, locale)} tone="brand" icon="wallet" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
        {/* Chap ustun: bugungi darslar + mening guruhlarim */}
        <div className="space-y-5 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <Icon name="calendar" className="h-4 w-4 text-brand-500" /> {tr(locale, { uz: "Bugungi darslar", ru: "Занятия сегодня", en: "Today's lessons" })}
              </h3>
              <Link href="/schedule" className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300">{tr(locale, { uz: "To'liq jadval", ru: "Всё расписание", en: "Full schedule" })} →</Link>
            </div>
            {todayGroups.length === 0 ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center text-center">
                <div className="text-4xl opacity-30">🎉</div>
                <p className="mt-2 text-sm text-slate-400">{tr(locale, { uz: "Bugun darsingiz yo'q", ru: "Сегодня занятий нет", en: "No lessons today" })}</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {todayGroups.map((g) => {
                  const sMin = toMin(g.startTime);
                  const eMin = toMin(g.endTime);
                  const past = eMin != null && eMin < nowMin;
                  const live = sMin != null && eMin != null && nowMin >= sMin && nowMin < eMin;
                  const color = groupColor(g.id, g.color);
                  return (
                    <li key={g.id}>
                      <Link href={`/groups/${g.id}`} className={`flex items-center gap-3 rounded-xl border p-3 transition hover:shadow-sm ${past ? "border-slate-100 opacity-60 dark:border-slate-800" : "border-slate-200/70 dark:border-slate-700"}`} style={{ borderLeftColor: color, borderLeftWidth: 4 }}>
                        <div className="w-[92px] shrink-0 text-center">
                          <div className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">{g.startTime ?? "—"}</div>
                          <div className="text-[11px] tabular-nums text-slate-400">{g.endTime ?? ""}</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-semibold text-slate-800 dark:text-slate-100">{g.name}</span>
                            {live && <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{tr(locale, { uz: "hozir", ru: "сейчас", en: "now" })}</span>}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-slate-400">{[g.program.name, g.levelCode, g.room].filter(Boolean).join(" · ")}</div>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{g._count.students} {tr(locale, { uz: "o'quvchi", ru: "уч.", en: "st." })}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Mening guruhlarim — Bugungi darslar tagida, bir xil kenglikda */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{tr(locale, { uz: "Mening guruhlarim", ru: "Мои группы", en: "My groups" })}</h3>
            {groups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 py-10 text-center dark:border-slate-700">
                <div className="text-3xl opacity-30">📚</div>
                <p className="mt-2 text-sm text-slate-400">{tr(locale, { uz: "Sizga guruh biriktirilmagan", ru: "Вам не назначены группы", en: "No groups assigned to you" })}</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {groups.map((g) => {
                  const color = groupColor(g.id, g.color);
                  return (
                    <Link key={g.id} href={`/groups/${g.id}`} className="group rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft dark:border-slate-800 dark:bg-slate-900" style={{ borderTopColor: color, borderTopWidth: 3 }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                          <span className="truncate font-bold text-slate-800 group-hover:text-brand-600 dark:text-slate-100">{g.name}</span>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">{g._count.students}/{g.capacity}</span>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5"><Icon name="book" className="h-3.5 w-3.5 text-slate-400" /> {[g.program.name, g.levelCode].filter(Boolean).join(" · ")}</div>
                        {g.room && <div className="flex items-center gap-1.5"><Icon name="building" className="h-3.5 w-3.5 text-slate-400" /> {g.room}</div>}
                        {g.weekdays && <div className="flex items-center gap-1.5"><Icon name="calendar" className="h-3.5 w-3.5 text-slate-400" /> {daysLabel(g.weekdays, locale)}{g.startTime ? ` · ${g.startTime}${g.endTime ? "–" + g.endTime : ""}` : ""}</div>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Tezkor havolalar */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{tr(locale, { uz: "Tezkor havolalar", ru: "Быстрые ссылки", en: "Quick links" })}</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <QuickLink href="/schedule" icon="calendar" label={tr(locale, { uz: "Dars jadvali", ru: "Расписание", en: "Schedule" })} />
            <QuickLink href="/students" icon="graduation" label={tr(locale, { uz: "O'quvchilar", ru: "Ученики", en: "Students" })} />
            <QuickLink href="/education" icon="book" label={tr(locale, { uz: "O'quv bo'limi", ru: "Учебное", en: "Education" })} />
            <QuickLink href="/tests" icon="filecheck" label={tr(locale, { uz: "Blok test", ru: "Блок-тест", en: "Block test" })} />
            <QuickLink href="/tasks" icon="clipboard" label={tr(locale, { uz: "Topshiriqlar", ru: "Задачи", en: "Tasks" })} />
            <QuickLink href="/reminders" icon="clock" label={tr(locale, { uz: "Eslatma", ru: "Напоминания", en: "Reminders" })} />
          </div>
        </div>
      </div>

    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200/70 p-3 text-center transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:hover:bg-brand-950/30">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-300"><Icon name={icon} className="h-4 w-4" /></span>
      <span className="text-[11px] font-medium leading-tight text-slate-600 dark:text-slate-300">{label}</span>
    </Link>
  );
}
