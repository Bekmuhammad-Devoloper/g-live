"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { exportRows } from "@/lib/export";
import { Icon } from "../_components/Icon";
import { COUNTRIES, flagOf, platform } from "../links/platforms";
import { toggleVacancy, removeVacancy } from "./actions";
import VacancyDrawer from "./VacancyDrawer";

export interface VVacancy {
  id: string; title: string; company: string | null;
  country: string | null; countryCode: string | null;
  jobTitle: string | null; salary: string | null; description: string | null;
  isActive: boolean; createdAt: string; createdByName: string | null;
  linkCount: number; activeLinks: number; views: number; applications: number;
  platforms: string[];
}
export interface VacStats { total: number; active: number; withLinks: number; views: number; applications: number }

const nf = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export default function VacanciesView({ locale, rows, stats, openNew }: {
  locale: Locale; rows: VVacancy[]; stats: VacStats; openNew?: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [status, setStatus] = useState<"" | "active" | "inactive">("");
  const [drawer, setDrawer] = useState<VVacancy | null | undefined>(openNew ? null : undefined);
  const [del, setDel] = useState<VVacancy | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };
  const L = (uz: string, ru: string, en: string) => tr(locale, { uz, ru, en });

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status === "active" && !r.isActive) return false;
      if (status === "inactive" && r.isActive) return false;
      if (country && (r.countryCode ?? r.country ?? "") !== country) return false;
      if (n && !`${r.title} ${r.company ?? ""} ${r.country ?? ""} ${r.jobTitle ?? ""}`.toLowerCase().includes(n)) return false;
      return true;
    });
  }, [rows, q, country, status]);

  const countries = useMemo(
    () => Array.from(new Set(rows.map((r) => r.countryCode ?? r.country).filter(Boolean) as string[])),
    [rows],
  );

  const onToggle = (r: VVacancy) => start(async () => {
    await toggleVacancy(r.id); router.refresh();
    flash(r.isActive ? L("Nofaol qilindi", "Деактивировано", "Deactivated") : L("Faollashtirildi", "Активировано", "Activated"));
  });

  const onDelete = () => {
    if (!del) return;
    const v = del; setDel(null);
    start(async () => {
      const res = await removeVacancy(v.id);
      router.refresh();
      flash(res.ok ? L("O'chirildi", "Удалено", "Deleted") : res.error ?? L("Xatolik", "Ошибка", "Error"));
    });
  };

  const csv = () => exportRows(
    "vakansiyalar",
    [
      { key: "title", label: L("Vakansiya", "Вакансия", "Vacancy") },
      { key: "company", label: L("Kompaniya", "Компания", "Company") },
      { key: "country", label: L("Davlat", "Страна", "Country") },
      { key: "jobTitle", label: L("Ish turi", "Тип работы", "Job type") },
      { key: "salary", label: L("Oylik", "Зарплата", "Salary") },
      { key: "linkCount", label: L("Linklar", "Ссылки", "Links") },
      { key: "views", label: L("Ko'rishlar", "Просмотры", "Views") },
      { key: "applications", label: L("Arizalar", "Заявки", "Applications") },
      { key: "st", label: L("Holat", "Статус", "Status") },
      { key: "createdAt", label: L("Sana", "Дата", "Date") },
    ],
    shown.map((r) => ({
      title: r.title, company: r.company ?? "", country: r.country ?? "", jobTitle: r.jobTitle ?? "",
      salary: r.salary ?? "", linkCount: r.linkCount, views: r.views, applications: r.applications,
      st: r.isActive ? L("Faol", "Активна", "Active") : L("Nofaol", "Неактивна", "Inactive"),
      createdAt: r.createdAt,
    })),
  );

  return (
    <div className="space-y-5">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {L("Vakansiyalar", "Вакансии", "Vacancies")}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {L("Ish o'rinlarini yaratish va boshqarish", "Создание и управление вакансиями", "Create and manage job openings")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={csv} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
            <Icon name="download" className="h-4 w-4" /> {L("Eksport", "Экспорт", "Export")}
          </button>
          <Link href="/links" className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
            <Icon name="link" className="h-4 w-4" /> {L("Havolalar", "Ссылки", "Links")}
          </Link>
          <button onClick={() => setDrawer(null)} className="flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
            <Icon name="plus" className="h-4 w-4" /> {L("Yangi vakansiya", "Новая вакансия", "New vacancy")}
          </button>
        </div>
      </div>

      {/* Ko'rsatkichlar */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label={L("Jami vakansiya", "Всего вакансий", "Total vacancies")} value={stats.total} icon="building" tone="#3b82f6" />
        <Tile label={L("Faol", "Активные", "Active")} value={stats.active} icon="check" tone="#10b981" />
        <Tile label={L("Ko'rishlar", "Просмотры", "Views")} value={nf(stats.views)} icon="eye" tone="#a855f7" />
        <Tile label={L("Arizalar", "Заявки", "Applications")} value={stats.applications} icon="users" tone="#f59e0b" />
      </div>

      {/* Filtrlar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={L("Vakansiya, kompaniya yoki davlat qidiring...", "Поиск вакансии, компании или страны...", "Search vacancy, company or country...")}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
        </div>
        <select value={country} onChange={(e) => setCountry(e.target.value)}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <option value="">{L("Barcha davlatlar", "Все страны", "All countries")}</option>
          {countries.map((c) => {
            const def = COUNTRIES.find((x) => x.code === c || x.name === c);
            return <option key={c} value={c}>{flagOf(c, c)} {def?.name ?? c}</option>;
          })}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <option value="">{L("Barcha holatlar", "Все статусы", "All statuses")}</option>
          <option value="active">{L("Faol", "Активные", "Active")}</option>
          <option value="inactive">{L("Nofaol", "Неактивные", "Inactive")}</option>
        </select>
        <button onClick={() => router.refresh()} title={L("Yangilash", "Обновить", "Refresh")}
          className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
          <Icon name="refresh" className="h-4 w-4" />
        </button>
      </div>

      {/* Jadval */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-white/[0.02]">
              <tr>
                <th className="w-12 px-4 py-3.5">#</th>
                <th className="px-4 py-3.5">{L("Vakansiya", "Вакансия", "Vacancy")}</th>
                <th className="px-4 py-3.5">{L("Davlat", "Страна", "Country")}</th>
                <th className="px-4 py-3.5 text-center">{L("Linklar", "Ссылки", "Links")}</th>
                <th className="px-4 py-3.5 text-center">{L("Ko'rishlar", "Просмотры", "Views")}</th>
                <th className="px-4 py-3.5 text-center">{L("Arizalar", "Заявки", "Applications")}</th>
                <th className="px-4 py-3.5 text-center">{L("Holat", "Статус", "Status")}</th>
                <th className="px-4 py-3.5">{L("Sana", "Дата", "Date")}</th>
                <th className="px-4 py-3.5 text-right">{L("Amallar", "Действия", "Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                      <Icon name="building" className="h-7 w-7" />
                    </div>
                    <p className="mt-3 font-medium text-slate-600 dark:text-slate-300">{L("Vakansiya topilmadi", "Вакансии не найдены", "No vacancies found")}</p>
                    <p className="mt-1 text-xs text-slate-400">{L("Yangi vakansiya yarating yoki filtrni o'zgartiring", "Создайте вакансию или измените фильтр", "Create a vacancy or change the filter")}</p>
                  </td>
                </tr>
              ) : shown.map((r, i) => (
                <tr key={r.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3.5 font-mono text-xs text-slate-400">{i + 1}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                        <Icon name="building" className="h-4.5 w-4.5" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-800 dark:text-slate-100">{r.title}</div>
                        <div className="truncate text-xs text-slate-400">
                          {[r.company, r.jobTitle, r.salary].filter(Boolean).join(" · ") || "—"}
                        </div>
                        {r.platforms.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {r.platforms.map((p) => {
                              const d = platform(p);
                              return (
                                <span key={p} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                                  style={{ background: `${d.color}1a`, color: d.color }}>
                                  <Icon name={d.icon} className="h-3 w-3" /> {d.label}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                    {r.country ? <>{flagOf(r.countryCode, r.country)} {r.country}</> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {r.linkCount > 0 ? (
                      <Link href={`/links?vacancyId=${r.id}`} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-brand-50 hover:text-brand-700 dark:bg-slate-800 dark:text-slate-300">
                        <Icon name="link" className="h-3.5 w-3.5" /> {r.activeLinks}/{r.linkCount}
                      </Link>
                    ) : (
                      <Link href={`/links?vacancyId=${r.id}`} className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
                        + {L("Link", "Ссылка", "Link")}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center tabular-nums text-slate-600 dark:text-slate-300">{nf(r.views)}</td>
                  <td className="px-4 py-3.5 text-center tabular-nums">
                    {r.applications > 0 ? <b className="text-emerald-600 dark:text-emerald-400">{r.applications}</b> : <span className="text-slate-300">0</span>}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <button onClick={() => onToggle(r)}
                      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition",
                        r.isActive ? "bg-emerald-500/12 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                                   : "bg-slate-200/70 text-slate-500 hover:bg-slate-300/70 dark:bg-slate-700 dark:text-slate-400")}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", r.isActive ? "bg-emerald-500" : "bg-slate-400")} />
                      {r.isActive ? L("Faol", "Активна", "Active") : L("Nofaol", "Неактивна", "Inactive")}
                    </button>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-500">{r.createdAt}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn title={L("Tahrirlash", "Редактировать", "Edit")} icon="pencil" onClick={() => setDrawer(r)} />
                      <IconBtn title={L("O'chirish", "Удалить", "Delete")} icon="trash" danger onClick={() => setDel(r)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shown.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400 dark:border-slate-800">
            {shown.length} / {rows.length} {L("ta vakansiya", "вакансий", "vacancies")}
          </div>
        )}
      </div>

      {drawer !== undefined && (
        <VacancyDrawer locale={locale} edit={drawer} onClose={() => setDrawer(undefined)}
          onSaved={(m) => { setDrawer(undefined); router.refresh(); flash(m); }} />
      )}

      {del && (
        <div className="fixed inset-0 z-[85] grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm" onMouseDown={() => setDel(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-pop dark:border-slate-800 dark:bg-slate-900" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-500/15">
              <Icon name="alert" className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-800 dark:text-slate-100">{L("Diqqat!", "Внимание!", "Warning!")}</h3>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              <b>{del.title}</b> {L("o'chiriladi.", "будет удалена.", "will be deleted.")}
              {del.linkCount > 0 && " " + L(`Unga tegishli ${del.linkCount} ta havola ham o'chadi.`, `Также будут удалены ${del.linkCount} ссылок.`, `Its ${del.linkCount} link(s) will also be deleted.`)}
            </p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setDel(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                {L("Bekor", "Отмена", "Cancel")}
              </button>
              <button onClick={onDelete} className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700">
                {L("O'chirish", "Удалить", "Delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-pop dark:bg-slate-700">{toast}</div>}
    </div>
  );
}

function Tile({ label, value, icon, tone }: { label: string; value: number | string; icon: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-slate-400">{label}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: tone }}>{value}</div>
        </div>
        <Icon name={icon} className="h-8 w-8 opacity-25" style={{ color: tone }} />
      </div>
    </div>
  );
}

function IconBtn({ title, icon, onClick, danger }: { title: string; icon: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} title={title}
      className={cn("grid h-8 w-8 place-items-center rounded-lg transition",
        danger ? "text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
               : "text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800")}>
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}
