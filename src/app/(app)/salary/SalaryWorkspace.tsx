"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { exportRows, printPage } from "@/lib/export";
import { saveTeacherSalary, type FormState } from "./actions";

export interface SalaryRow {
  teacherId: string;
  name: string;
  fiksa: number;
  lessons: number;
  students: number;
  bonus: number;
  penalty: number;
  kpi: number;
  net: number;
  hasRecord: boolean;
  closed: boolean;
}

const MONTHS_ML: { uz: string; ru: string; en: string }[] = [
  { uz: "Yanvar", ru: "Январь", en: "January" },
  { uz: "Fevral", ru: "Февраль", en: "February" },
  { uz: "Mart", ru: "Март", en: "March" },
  { uz: "Aprel", ru: "Апрель", en: "April" },
  { uz: "May", ru: "Май", en: "May" },
  { uz: "Iyun", ru: "Июнь", en: "June" },
  { uz: "Iyul", ru: "Июль", en: "July" },
  { uz: "Avgust", ru: "Август", en: "August" },
  { uz: "Sentabr", ru: "Сентябрь", en: "September" },
  { uz: "Oktabr", ru: "Октябрь", en: "October" },
  { uz: "Noyabr", ru: "Ноябрь", en: "November" },
  { uz: "Dekabr", ru: "Декабрь", en: "December" },
];
const monthName = (locale: Locale, m: number) => tr(locale, MONTHS_ML[m - 1]);

export default function SalaryWorkspace({
  year, month, rows, canManage, locale,
}: {
  year: number; month: number; rows: SalaryRow[]; canManage: boolean; locale: Locale;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<SalaryRow | null>(null);

  const go = (y: number, m: number) => {
    router.push(`/salary?year=${y}&month=${m}`);
  };
  const prev = () => (month === 1 ? go(year - 1, 12) : go(year, month - 1));
  const next = () => (month === 12 ? go(year + 1, 1) : go(year, month + 1));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  const totalNet = filtered.reduce((n, r) => n + (r.hasRecord ? r.net : r.fiksa), 0);

  const doExport = () => {
    exportRows(
      `maosh-${year}-${String(month).padStart(2, "0")}`,
      [
        { key: "name", label: tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" }) },
        { key: "fiksa", label: tr(locale, { uz: "Fiksa (so'm)", ru: "Фикс (сум)", en: "Base (UZS)" }) },
        { key: "lessons", label: tr(locale, { uz: "Darslar", ru: "Занятия", en: "Lessons" }) },
        { key: "students", label: tr(locale, { uz: "O'quvchilar", ru: "Ученики", en: "Students" }) },
        { key: "bonus", label: tr(locale, { uz: "Bonus (so'm)", ru: "Бонус (сум)", en: "Bonus (UZS)" }) },
        { key: "penalty", label: tr(locale, { uz: "Ushlanma (so'm)", ru: "Удержание (сум)", en: "Deduction (UZS)" }) },
        { key: "kpi", label: tr(locale, { uz: "KPI (so'm)", ru: "KPI (сум)", en: "KPI (UZS)" }) },
        { key: "net", label: tr(locale, { uz: "Jami (so'm)", ru: "Итого (сум)", en: "Total (UZS)" }) },
        { key: "status", label: tr(locale, { uz: "Holati", ru: "Статус", en: "Status" }) },
      ],
      filtered.map((r) => ({
        name: r.name,
        fiksa: r.fiksa,
        lessons: r.lessons,
        students: r.students,
        bonus: r.hasRecord ? r.bonus : 0,
        penalty: r.hasRecord ? r.penalty : 0,
        kpi: r.hasRecord ? r.kpi : 0,
        net: r.hasRecord ? r.net : r.fiksa,
        status: !r.hasRecord ? tr(locale, { uz: "Hisoblanmagan", ru: "Не рассчитано", en: "Not calculated" }) : r.closed ? tr(locale, { uz: "Yopilgan", ru: "Закрыто", en: "Closed" }) : tr(locale, { uz: "Hisoblangan", ru: "Рассчитано", en: "Calculated" }),
      })),
    );
  };

  return (
    <div className="space-y-4">
      {/* Boshqaruv paneli: davr navigatori + qidiruv + eksport */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
          <button onClick={prev} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-700" aria-label={tr(locale, { uz: "Oldingi oy", ru: "Предыдущий месяц", en: "Previous month" })}>‹</button>
          <span className="min-w-[130px] px-2 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">{monthName(locale, month)} {year}</span>
          <button onClick={next} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-700" aria-label={tr(locale, { uz: "Keyingi oy", ru: "Следующий месяц", en: "Next month" })}>›</button>
        </div>

        <div className="relative">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr(locale, { uz: "O'qituvchi qidirish", ru: "Поиск преподавателя", en: "Search teacher" })}
            className="h-10 w-56 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={doExport} className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
            ⬇ {tr(locale, { uz: "Eksport (CSV)", ru: "Экспорт (CSV)", en: "Export (CSV)" })}
          </button>
          <button onClick={printPage} className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
            🖨 {tr(locale, { uz: "Chop etish", ru: "Печать", en: "Print" })}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 dark:border-slate-800">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{monthName(locale, month)} {year} — {tr(locale, { uz: "hisob-kitob", ru: "расчёт", en: "calculation" })}</span>
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{tr(locale, { uz: "Fond", ru: "Фонд", en: "Fund" })}: {formatMoney(totalNet, locale)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" style={{ minWidth: 980 }}>
            <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="w-12 px-4 py-3">№</th>
                <th className="px-4 py-3">{tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Fiksa", ru: "Фикс", en: "Base" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Darslar", ru: "Занятия", en: "Lessons" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "O'quvchilar", ru: "Ученики", en: "Students" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Bonus", ru: "Бонус", en: "Bonus" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Ushlanma", ru: "Удержание", en: "Deduction" })}</th>
                <th className="px-4 py-3">KPI</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Jami", ru: "Итого", en: "Total" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Holati", ru: "Статус", en: "Status" })}</th>
                {canManage && <th className="px-4 py-3 print:hidden">{tr(locale, { uz: "Amal", ru: "Действие", en: "Action" })}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr><td colSpan={canManage ? 11 : 10} className="px-4 py-16 text-center">
                  <div className="text-3xl opacity-30">📭</div>
                  <p className="mt-2 font-medium text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi", ru: "Данные не найдены", en: "No data found" })}</p>
                </td></tr>
              ) : filtered.map((r, i) => (
                <tr key={r.teacherId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{r.name}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">{formatMoney(r.fiksa, locale)}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-500">{r.lessons}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-500">{r.students}</td>
                  <td className="px-4 py-3 tabular-nums text-emerald-600 dark:text-emerald-400">{r.hasRecord ? formatMoney(r.bonus, locale) : "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-rose-600 dark:text-rose-400">{r.hasRecord ? formatMoney(r.penalty, locale) : "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-violet-600 dark:text-violet-400">{r.hasRecord && r.kpi > 0 ? `+${formatMoney(r.kpi, locale)}` : "—"}</td>
                  <td className="px-4 py-3 tabular-nums font-semibold text-slate-800 dark:text-slate-100">{formatMoney(r.hasRecord ? r.net : r.fiksa, locale)}</td>
                  <td className="px-4 py-3">
                    {!r.hasRecord ? (
                      <span className="rounded-md bg-slate-400/20 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{tr(locale, { uz: "Hisoblanmagan", ru: "Не рассчитано", en: "Not calculated" })}</span>
                    ) : r.closed ? (
                      <span className="rounded-md bg-slate-400/20 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{tr(locale, { uz: "Yopilgan", ru: "Закрыто", en: "Closed" })}</span>
                    ) : (
                      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">{tr(locale, { uz: "Hisoblangan", ru: "Рассчитано", en: "Calculated" })}</span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 print:hidden">
                      <button
                        onClick={() => setEdit(r)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {r.hasRecord ? tr(locale, { uz: "Tahrirlash", ru: "Редактировать", en: "Edit" }) : tr(locale, { uz: "Hisoblash", ru: "Рассчитать", en: "Calculate" })}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {edit && <SalaryDrawer row={edit} year={year} month={month} locale={locale} onClose={() => setEdit(null)} />}
    </div>
  );
}

function SalaryDrawer({ row, year, month, locale, onClose }: { row: SalaryRow; year: number; month: number; locale: Locale; onClose: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveTeacherSalary, {});
  const [mounted, setMounted] = useState(false);
  const [bonus, setBonus] = useState(row.hasRecord ? row.bonus : 0);
  const [penalty, setPenalty] = useState(row.hasRecord ? row.penalty : 0);
  const [kpi, setKpi] = useState(row.hasRecord ? row.kpi : 0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOv = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prevOv; };
  }, [onClose]);
  useEffect(() => { if (state.ok) { onClose(); } /* eslint-disable-next-line */ }, [state.ok]);

  if (!mounted) return null;
  const net = row.fiksa + Number(bonus || 0) + Number(kpi || 0) - Number(penalty || 0);
  const inp = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <form ref={formRef} action={action} onMouseDown={(e) => e.stopPropagation()} className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[440px] max-w-[92%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Maosh hisobi", ru: "Расчёт зарплаты", en: "Salary calculation" })}</h3>
            <p className="text-xs text-slate-400">{row.name} · {monthName(locale, month)} {year}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">✕</button>
        </div>

        <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          <input type="hidden" name="teacherId" value={row.teacherId} />
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
              <div className="text-xs text-slate-400">{tr(locale, { uz: "Fiksa", ru: "Фикс", en: "Base" })}</div>
              <div className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{formatMoney(row.fiksa, locale)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
              <div className="text-xs text-slate-400">{tr(locale, { uz: "Darslar / O'quvchilar", ru: "Занятия / Ученики", en: "Lessons / Students" })}</div>
              <div className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{row.lessons} / {row.students}</div>
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Bonus (so'm)", ru: "Бонус (сум)", en: "Bonus (UZS)" })}</span>
            <input name="bonus" type="number" min="0" value={bonus} onChange={(e) => setBonus(Number(e.target.value))} className={inp} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Ushlanma (so'm)", ru: "Удержание (сум)", en: "Deduction (UZS)" })}</span>
            <input name="penalty" type="number" min="0" value={penalty} onChange={(e) => setPenalty(Number(e.target.value))} className={inp} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{tr(locale, { uz: "KPI bonus (so'm)", ru: "KPI бонус (сум)", en: "KPI bonus (UZS)" })}</span>
            <input name="kpi" type="number" min="0" value={kpi} onChange={(e) => setKpi(Number(e.target.value))} className={inp} />
          </label>

          <label className="flex items-center gap-2 pt-1">
            <input name="closed" type="checkbox" defaultChecked={row.closed} className="h-4 w-4 rounded border-slate-300" />
            <span className="text-sm text-slate-600 dark:text-slate-300">{tr(locale, { uz: "Oyni yopish (tasdiqlash)", ru: "Закрыть месяц (утвердить)", en: "Close month (confirm)" })}</span>
          </label>

          <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5 dark:border-brand-500/20 dark:bg-brand-500/10">
            <div className="text-xs text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Jami to'lov", ru: "Итого к выплате", en: "Total payment" })}</div>
            <div className="text-lg font-bold tabular-nums text-brand-700 dark:text-brand-300">{formatMoney(net, locale)}</div>
          </div>

          {state.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{state.error === "forbidden" ? tr(locale, { uz: "Ruxsat yo'q.", ru: "Нет доступа.", en: "No access." }) : tr(locale, { uz: "Ma'lumotlar to'liq emas.", ru: "Данные заполнены не полностью.", en: "Data is incomplete." })}</p>}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">{tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel" })}</button>
          <button type="submit" disabled={pending} className="flex-[1.4] rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">{pending ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving..." }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save" })}</button>
        </div>
      </form>
    </div>, document.body);
}
