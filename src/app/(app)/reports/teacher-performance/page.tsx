import { Fragment } from "react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { branchWhere } from "@/lib/branchScope";
import { Forbidden } from "../../_components/ui";
import DateRangeNav from "./DateRangeNav";
import { SortHeader, ExportButton, type TeacherRow } from "./TableTools";

const p2 = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

const ACTIVE = ["ACTIVE"];
const LEFT = ["EXPELLED", "TRANSFERRED"];
const GRAD = ["CERTIFIED", "PROGRAM_DONE"];
const FROZEN = ["FROZEN"];

interface Cnt { active: number; left: number; grad: number; frozen: number }
const emptyCnt = (): Cnt => ({ active: 0, left: 0, grad: 0, frozen: 0 });

export default async function TeacherPerformancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.REPORTS)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsat yo'q.", ru: "Нет доступа к этому разделу.", en: "You don't have access to this section.", de: "Sie haben keinen Zugriff auf diesen Bereich." })} />;
  }
  const sp = await searchParams;
  const now = new Date();
  const fromStr = sp.from || iso(new Date(now.getFullYear(), now.getMonth(), 1));
  const toStr = sp.to || iso(now);
  const from = new Date(fromStr + "T00:00:00");
  const to = new Date(toStr + "T23:59:59");

  const teachers = await prisma.user.findMany({
    where: { AND: [{ role: ROLES.TEACHER, isActive: true }, branchWhere(s)] }, // faol filial doirasida
    orderBy: { fullName: "asc" },
    select: {
      id: true, fullName: true,
      // guruhlar ham faol filial doirasida
      teacherGroups: { where: branchWhere(s), select: { students: { select: { joinedAt: true, student: { select: { id: true, eduStatus: true } } } } } },
    },
  });

  const rows = teachers.map((t) => {
    const seen = new Map<string, string>(); // studentId -> eduStatus
    let joinsInPeriod = 0;
    for (const g of t.teacherGroups) {
      for (const gs of g.students) {
        seen.set(gs.student.id, gs.student.eduStatus);
        if (gs.joinedAt >= from && gs.joinedAt <= to) joinsInPeriod++;
      }
    }
    const end = emptyCnt();
    for (const st of seen.values()) {
      if (ACTIVE.includes(st)) end.active++;
      else if (LEFT.includes(st)) end.left++;
      else if (GRAD.includes(st)) end.grad++;
      else if (FROZEN.includes(st)) end.frozen++;
    }
    const changes: Cnt = { active: joinsInPeriod, left: 0, grad: 0, frozen: 0 };
    const start: Cnt = { active: Math.max(0, end.active - joinsInPeriod), left: end.left, grad: end.grad, frozen: end.frozen };
    return { id: t.id, name: t.fullName, start, changes, end };
  });

  // Saralash (ustun bo'yicha) — URL orqali
  const sortKey = sp.sort || "";
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const flat = (r: (typeof rows)[number]): TeacherRow => ({
    name: r.name,
    s_active: r.start.active, s_left: r.start.left, s_grad: r.start.grad, s_frozen: r.start.frozen,
    c_active: r.changes.active, c_left: r.changes.left, c_grad: r.changes.grad, c_frozen: r.changes.frozen,
    e_active: r.end.active, e_left: r.end.left, e_grad: r.end.grad, e_frozen: r.end.frozen,
  });
  if (sortKey) {
    rows.sort((a, b) => {
      const fa = flat(a) as unknown as Record<string, string | number>;
      const fb = flat(b) as unknown as Record<string, string | number>;
      const va = fa[sortKey] ?? 0;
      const vb = fb[sortKey] ?? 0;
      let cmp: number;
      if (typeof va === "string" || typeof vb === "string") cmp = String(va).localeCompare(String(vb));
      else cmp = (va as number) - (vb as number);
      return dir === "asc" ? cmp : -cmp;
    });
  }
  const exportRowsData = rows.map(flat);
  const BUCKET_KEYS = ["active", "left", "grad", "frozen"] as const;
  const GROUP_PREFIX = ["s", "c", "e"] as const;
  const BUCKET_LABELS = [
    tr(s.locale, { uz: "Aktiv", ru: "Активные", en: "Active", de: "Aktiv" }),
    tr(s.locale, { uz: "Ketganlar", ru: "Ушедшие", en: "Left", de: "Ausgetreten" }),
    tr(s.locale, { uz: "Bitirganlar", ru: "Выпускники", en: "Graduated", de: "Absolventen" }),
    tr(s.locale, { uz: "Muzlatilgan", ru: "Замороженные", en: "Frozen", de: "Eingefroren" }),
  ];

  const th = "px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500";
  const cell = (n: number, tone: string) => <td className={`px-3 py-3 text-center tabular-nums ${n ? tone : "text-slate-300 dark:text-slate-600"}`}>{n}</td>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(s.locale, { uz: "O'qituvchilar samaradorligi", ru: "Эффективность преподавателей", en: "Teacher performance", de: "Lehrerleistung" })}</h1>
        <div className="flex items-center gap-2">
          <DateRangeNav from={fromStr} to={toStr} />
          <ExportButton rows={exportRowsData} locale={s.locale} />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/50">
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th rowSpan={2} className="px-4 py-2 text-[11px] font-semibold uppercase text-slate-500">№</th>
                <th rowSpan={2} className="px-4 py-2 text-[11px] font-semibold uppercase text-slate-500">
                  <SortHeader col="name" label={tr(s.locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher", de: "Lehrer" })} active={sortKey} dir={dir} locale={s.locale} />
                </th>
                <th colSpan={4} className="border-l border-slate-200 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:text-slate-300">{tr(s.locale, { uz: "Davr boshidagi holati", ru: "Состояние на начало периода", en: "Status at start of period", de: "Status zu Beginn des Zeitraums" })}</th>
                <th colSpan={4} className="border-l border-slate-200 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:text-slate-300">{tr(s.locale, { uz: "O'zgarishlar", ru: "Изменения", en: "Changes", de: "Änderungen" })}</th>
                <th colSpan={4} className="border-l border-slate-200 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:text-slate-300">{tr(s.locale, { uz: "Davr oxiridagi holati", ru: "Состояние на конец периода", en: "Status at end of period", de: "Status am Ende des Zeitraums" })}</th>
              </tr>
              <tr>
                {[0, 1, 2].map((g) => (
                  <Fragment key={g}>
                    {BUCKET_KEYS.map((bk, bi) => (
                      <th key={bk} className={`${th}${bi === 0 ? " border-l border-slate-200 dark:border-slate-700" : ""}`}>
                        <SortHeader col={`${GROUP_PREFIX[g]}_${bk}`} label={BUCKET_LABELS[bi]} active={sortKey} dir={dir} locale={s.locale} />
                      </th>
                    ))}
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.length === 0 ? (
                <tr><td colSpan={14} className="py-16 text-center text-slate-400">{tr(s.locale, { uz: "Ma'lumotlar topilmadi", ru: "Данные не найдены", en: "No data found", de: "Keine Daten gefunden" })}</td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{r.name}</td>
                  {([r.start, r.changes, r.end] as Cnt[]).map((c, gi) => (
                    <Fragment key={gi}>
                      <td className={`border-l border-slate-100 px-3 py-3 text-center tabular-nums dark:border-slate-800 ${c.active ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-slate-300 dark:text-slate-600"}`}>{c.active}</td>
                      {cell(c.left, "text-rose-500")}
                      {cell(c.grad, "font-semibold text-brand-600 dark:text-brand-300")}
                      {cell(c.frozen, "text-sky-600 dark:text-sky-400")}
                    </Fragment>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-slate-400">{tr(s.locale, { uz: "Izoh: holatlar hozirgi o'quvchi statuslari asosida hisoblanadi. \"O'zgarishlar\" — tanlangan davrda guruhga qo'shilgan yangi o'quvchilar.", ru: "Примечание: состояния рассчитываются на основе текущих статусов учеников. \"Изменения\" — новые ученики, добавленные в группу за выбранный период.", en: "Note: statuses are calculated based on current student statuses. \"Changes\" are new students added to the group during the selected period.", de: "Hinweis: Die Status werden anhand der aktuellen Schülerstatus berechnet. \"Änderungen\" sind neue Schüler, die im ausgewählten Zeitraum der Gruppe hinzugefügt wurden." })}</p>
    </div>
  );
}
