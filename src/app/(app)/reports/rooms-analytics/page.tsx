import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import Controls from "./Controls";
import { SortHeader, ExportButton } from "./TableTools";

const p2 = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

export default async function RoomsAnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.REPORTS)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsat yo'q.", ru: "Нет доступа к этому разделу.", en: "You don't have access to this section." })} />;
  }
  const sp = await searchParams;
  const now = new Date();
  const fromStr = sp.from || iso(new Date(now.getFullYear(), now.getMonth(), 1));
  const toStr = sp.to || iso(now);
  const from = new Date(fromStr + "T00:00:00");
  const to = new Date(toStr + "T23:59:59");
  const period = ["day", "week", "month"].includes(sp.period || "") ? sp.period! : "day";
  const view = sp.view === "grid" ? "grid" : "list";

  // Darslardan xonalar bandligini yig'ish
  const lessons = await prisma.lesson.findMany({
    where: { startsAt: { gte: from, lte: to } },
    select: { startsAt: true, endsAt: true, group: { select: { name: true, room: true } } },
  });

  const map = new Map<string, { room: string; sessions: number; minutes: number; days: Set<string>; groups: Set<string> }>();
  for (const l of lessons) {
    const room = l.group.room || tr(s.locale, { uz: "Belgilanmagan", ru: "Не указано", en: "Unassigned" });
    let e = map.get(room);
    if (!e) { e = { room, sessions: 0, minutes: 0, days: new Set(), groups: new Set() }; map.set(room, e); }
    e.sessions++;
    const dur = l.endsAt ? (l.endsAt.getTime() - l.startsAt.getTime()) / 60000 : 90;
    e.minutes += dur > 0 ? dur : 0;
    e.days.add(iso(l.startsAt));
    if (l.group.name) e.groups.add(l.group.name);
  }
  const rows = [...map.values()]
    .map((e) => ({ room: e.room, sessions: e.sessions, hours: Math.round((e.minutes / 60) * 10) / 10, days: e.days.size, groups: [...e.groups] }));

  // Saralash (ustun bo'yicha) — URL orqali. Default: seanslar bo'yicha kamayish tartibida.
  const sortKey = ["room", "sessions", "hours", "days"].includes(sp.sort || "") ? sp.sort! : "sessions";
  const dir = sp.dir === "asc" ? "asc" : "desc";
  rows.sort((a, b) => {
    const va = a[sortKey as "room" | "sessions" | "hours" | "days"];
    const vb = b[sortKey as "room" | "sessions" | "hours" | "days"];
    const cmp = typeof va === "string" || typeof vb === "string" ? String(va).localeCompare(String(vb)) : (va as number) - (vb as number);
    return dir === "asc" ? cmp : -cmp;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(s.locale, { uz: "Xonalar analitikasi", ru: "Аналитика кабинетов", en: "Rooms analytics" })}</h1>
          {rows.length === 0 && <p className="mt-1 text-sm text-slate-400">{tr(s.locale, { uz: "Ma'lumotlar topilmadi", ru: "Данные не найдены", en: "No data found" })}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Controls from={fromStr} to={toStr} period={period} view={view} locale={s.locale} />
          <ExportButton rows={rows} locale={s.locale} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-20 text-center text-slate-400 dark:border-slate-700">
          <div className="text-4xl opacity-30">🏢</div>
          <p className="mt-2">{tr(s.locale, { uz: "Tanlangan davrda xona bandligi topilmadi", ru: "За выбранный период занятость кабинетов не найдена", en: "No room usage found for the selected period" })}</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((r) => (
            <div key={r.room} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">🏢 {r.room}</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <Stat value={r.sessions} label={tr(s.locale, { uz: "Seans", ru: "Сеанс", en: "Session" })} />
                <Stat value={r.hours} label={tr(s.locale, { uz: "Soat", ru: "Час", en: "Hour" })} />
                <Stat value={r.days} label={tr(s.locale, { uz: "Band kun", ru: "Занятых дней", en: "Busy days" })} />
                <Stat value={r.groups.length} label={tr(s.locale, { uz: "Guruh", ru: "Группа", en: "Group" })} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="w-12 px-4 py-3">№</th>
                  <th className="px-4 py-3"><SortHeader col="room" label={tr(s.locale, { uz: "Xona", ru: "Кабинет", en: "Room" })} active={sortKey} dir={dir} locale={s.locale} /></th>
                  <th className="px-4 py-3 text-center"><SortHeader col="sessions" label={tr(s.locale, { uz: "Seanslar", ru: "Сеансы", en: "Sessions" })} active={sortKey} dir={dir} locale={s.locale} /></th>
                  <th className="px-4 py-3 text-center"><SortHeader col="hours" label={tr(s.locale, { uz: "Soatlar", ru: "Часы", en: "Hours" })} active={sortKey} dir={dir} locale={s.locale} /></th>
                  <th className="px-4 py-3 text-center"><SortHeader col="days" label={tr(s.locale, { uz: "Band kunlar", ru: "Занятых дней", en: "Busy days" })} active={sortKey} dir={dir} locale={s.locale} /></th>
                  <th className="px-4 py-3">{tr(s.locale, { uz: "Guruhlar", ru: "Группы", en: "Groups" })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r, i) => (
                  <tr key={r.room} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{r.room}</td>
                    <td className="px-4 py-3 text-center font-semibold text-brand-600 dark:text-brand-300">{r.sessions}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-slate-600 dark:text-slate-300">{r.hours}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{r.days}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.groups.length === 0 ? "—" : r.groups.map((g) => <span key={g} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700/50 dark:text-slate-300">{g}</span>)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-slate-50 py-2 dark:bg-white/[0.03]">
      <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{value}</div>
      <div className="text-[10px] text-slate-400">{label}</div>
    </div>
  );
}
