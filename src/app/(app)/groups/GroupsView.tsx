"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";
import NewGroupForm from "./NewGroupForm";
import { EditGroupButton, type EditGroupData } from "./[id]/GroupForms";
import { deleteGroup, setGroupActive } from "./actions";
import { groupColor } from "./groupColor";

export interface VGroup {
  id: string;
  name: string;
  program: string;
  level: string | null;
  teacherName: string | null;
  weekdays: number[];
  startTime: string | null;
  endTime: string | null;
  groupTime: string; // boshlanish sanasi (formatlangan)
  groupEndTime: string; // tugash sanasi (formatlangan)
  students: number;
  capacity: number;
  room: string | null;
  status: string;
  // Tahrirlash uchun (EditGroupData'ga mos)
  programId: string;
  teacherId: string | null;
  color: string | null;
  format: string;
  onlineLink: string | null;
  startDate: string | null; // "yyyy-mm-dd"
  endDate: string | null; // "yyyy-mm-dd"
  note: string | null; // izoh/kament
}

const wdLabel = (locale: Locale, d: number) =>
  [
    "",
    tr(locale, { uz: "Du", ru: "Пн", en: "Mon" }),
    tr(locale, { uz: "Se", ru: "Вт", en: "Tue" }),
    tr(locale, { uz: "Ch", ru: "Ср", en: "Wed" }),
    tr(locale, { uz: "Pa", ru: "Чт", en: "Thu" }),
    tr(locale, { uz: "Ju", ru: "Пт", en: "Fri" }),
    tr(locale, { uz: "Sh", ru: "Сб", en: "Sat" }),
    tr(locale, { uz: "Ya", ru: "Вс", en: "Sun" }),
  ][d] ?? "";
const ODD = [1, 3, 5];
const EVEN = [2, 4, 6];
const daysLabel = (arr: number[], locale: Locale) => (arr.length ? arr.map((d) => wdLabel(locale, d)).join(", ") : "—");
const statusTone: Record<string, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  PLANNED: "bg-slate-400/20 text-slate-500",
  FINISHED: "bg-slate-400/20 text-slate-500",
  CANCELLED: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};
const STATUS_LABEL: Record<string, { uz: string; ru: string; en: string }> = {
  ACTIVE: { uz: "Faol", ru: "Активна", en: "Active" },
  PLANNED: { uz: "Nofaol", ru: "Неактивна", en: "Inactive" },
  FINISHED: { uz: "Yakunlangan", ru: "Завершена", en: "Finished" },
  CANCELLED: { uz: "Bekor qilingan", ru: "Отменена", en: "Cancelled" },
};
const statusLabel = (st: string, locale: Locale) => tr(locale, STATUS_LABEL[st] ?? { uz: st, ru: st, en: st });

type SortKey = "name" | "students" | "teacher";

export default function GroupsView({
  locale,
  groups,
  totalStudents,
  frozenStudents,
  canCreate,
  programs,
  teachers,
  teacherNames,
  programNames,
  rooms,
  roomOptions,
}: {
  locale: Locale;
  groups: VGroup[];
  totalStudents: number;
  frozenStudents: number;
  canCreate: boolean;
  programs: { id: string; name: string }[];
  teachers: { id: string; fullName: string }[];
  teacherNames: string[];
  programNames: string[];
  rooms: string[];
  roomOptions: { id: string; name: string; capacity: number }[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [teacher, setTeacher] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [day, setDay] = useState("");
  const [program, setProgram] = useState("");
  const [room, setRoom] = useState("");
  const [statusF, setStatusF] = useState("ACTIVE");
  const [oddEven, setOddEven] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "students", dir: "asc" });
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const hasFilters = !!(teacher || startTime || endTime || day || program || room || oddEven || search || statusF !== "ACTIVE");

  function resetFilters() {
    setTeacher(""); setStartTime(""); setEndTime(""); setDay(""); setProgram(""); setRoom(""); setStatusF("ACTIVE"); setOddEven(""); setSearch("");
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = groups.filter((g) => {
      if (statusF !== "ALL" && g.status !== statusF) return false;
      if (teacher && g.teacherName !== teacher) return false;
      if (program && g.program !== program) return false;
      if (room && g.room !== room) return false;
      if (day && !g.weekdays.includes(Number(day))) return false;
      if (startTime && (!g.startTime || g.startTime < startTime)) return false;
      if (endTime && (!g.endTime || g.endTime > endTime)) return false;
      if (oddEven === "odd" && !(g.weekdays.length && g.weekdays.every((d) => ODD.includes(d)))) return false;
      if (oddEven === "even" && !(g.weekdays.length && g.weekdays.every((d) => EVEN.includes(d)))) return false;
      if (q && !`${g.name} ${g.teacherName ?? ""} ${g.program} ${g.room ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      if (sort.key === "students") return (a.students - b.students) * dir;
      if (sort.key === "teacher") return (a.teacherName ?? "").localeCompare(b.teacherName ?? "") * dir;
      return a.name.localeCompare(b.name) * dir;
    });
    return list;
  }, [groups, statusF, teacher, program, room, day, startTime, endTime, oddEven, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const shown = filtered.slice((curPage - 1) * pageSize, curPage * pageSize);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  return (
    <div className="space-y-3">
      {/* Toolbar 1-qator */}
      <div className="flex flex-wrap items-center gap-2">
        {canCreate && (
          <button onClick={() => setAddOpen(true)} className="flex h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
            <Icon name="plus" className="h-4 w-4" /> {tr(locale, { uz: "Qo'shish", ru: "Добавить", en: "Add" })}
          </button>
        )}

        <FilterSelect value={teacher} onChange={setTeacher} placeholder={tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" })} options={teacherNames.map((n) => ({ v: n, label: n }))} />

        <TimeFilter label={tr(locale, { uz: "Boshlanish vaqti", ru: "Время начала", en: "Start time" })} value={startTime} onChange={setStartTime} />
        <TimeFilter label={tr(locale, { uz: "Tugash vaqti", ru: "Время окончания", en: "End time" })} value={endTime} onChange={setEndTime} />

        <FilterSelect value={day} onChange={setDay} placeholder={tr(locale, { uz: "Kun", ru: "День", en: "Day" })} options={[1, 2, 3, 4, 5, 6, 7].map((i) => ({ v: String(i), label: wdLabel(locale, i) }))} />
        <FilterSelect value={program} onChange={setProgram} placeholder={tr(locale, { uz: "Kurs", ru: "Курс", en: "Course" })} options={programNames.map((n) => ({ v: n, label: n }))} />
        <FilterSelect value={room} onChange={setRoom} placeholder={tr(locale, { uz: "Xona", ru: "Кабинет", en: "Room" })} options={rooms.map((n) => ({ v: n, label: n }))} />

        <button
          onClick={resetFilters}
          title={tr(locale, { uz: "Filtrlarni tozalash", ru: "Очистить фильтры", en: "Clear filters" })}
          className={cn("flex h-10 w-10 items-center justify-center rounded-lg border transition", hasFilters ? "border-brand-300 text-brand-600 hover:bg-brand-50 dark:border-brand-500/40 dark:text-brand-300" : "border-slate-200 text-slate-400 dark:border-slate-700")}
        >
          <Icon name="filter" className="h-4 w-4" />
        </button>
      </div>

      {/* Toolbar 2-qator (o'ngga) */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <FilterSelect value={statusF} onChange={setStatusF} placeholder={tr(locale, { uz: "Holat", ru: "Статус", en: "Status" })} allowEmpty={false}
          options={[{ v: "ACTIVE", label: tr(locale, { uz: "Aktiv guruh", ru: "Активная группа", en: "Active group" }) }, { v: "ALL", label: tr(locale, { uz: "Barcha guruhlar", ru: "Все группы", en: "All groups" }) }, { v: "PLANNED", label: tr(locale, { uz: "Rejalashtirilgan", ru: "Запланировано", en: "Planned" }) }, { v: "FINISHED", label: tr(locale, { uz: "Tugagan", ru: "Завершено", en: "Finished" }) }]} />
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr(locale, { uz: "Qidirish", ru: "Поиск", en: "Search" })} className="h-10 w-56 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
        </div>
        <FilterSelect value={oddEven} onChange={setOddEven} placeholder={tr(locale, { uz: "Toq/Juft kunlar", ru: "Нечётные/чётные дни", en: "Odd/even days" })}
          options={[{ v: "odd", label: tr(locale, { uz: "Toq kunlar (Du-Ch-Ju)", ru: "Нечётные дни (Пн-Ср-Пт)", en: "Odd days (Mon-Wed-Fri)" }) }, { v: "even", label: tr(locale, { uz: "Juft kunlar (Se-Pa-Sh)", ru: "Чётные дни (Вт-Чт-Сб)", en: "Even days (Tue-Thu-Sat)" }) }]} />
      </div>

      {/* Statistika qatori */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
        <span>{tr(locale, { uz: "Jami o'quvchilar soni:", ru: "Всего учеников:", en: "Total students:" })} <b className="text-slate-800 dark:text-slate-200">{totalStudents}</b></span>
        <span>{tr(locale, { uz: "Muzlatilgan o'quvchilar soni:", ru: "Замороженных учеников:", en: "Frozen students:" })} <b className="text-slate-800 dark:text-slate-200">{frozenStudents}</b></span>
      </div>

      {/* Jadval */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-end border-b border-slate-100 px-4 py-2 dark:border-slate-800">
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{tr(locale, { uz: "Umumiy soni:", ru: "Всего:", en: "Total:" })} {filtered.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 w-12">№</th>
                <SortableTh label={tr(locale, { uz: "Guruh nomi", ru: "Название группы", en: "Group name" })} active={sort.key === "name"} dir={sort.dir} onClick={() => toggleSort("name")} />
                <th className="px-4 py-3">{tr(locale, { uz: "Kurs", ru: "Курс", en: "Course" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Darajasi", ru: "Уровень", en: "Level" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Kun", ru: "День", en: "Day" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Dars vaqti", ru: "Время урока", en: "Lesson time" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Boshlanish sanasi", ru: "Дата начала", en: "Start date" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Tugash sanasi", ru: "Дата окончания", en: "End date" })}</th>
                <SortableTh label={tr(locale, { uz: "O'quvchilar", ru: "Ученики", en: "Students" })} active={sort.key === "students"} dir={sort.dir} onClick={() => toggleSort("students")} />
                <SortableTh label={tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" })} active={sort.key === "teacher"} dir={sort.dir} onClick={() => toggleSort("teacher")} />
                <th className="px-4 py-3 text-right">{tr(locale, { uz: "Amallar", ru: "Действия", en: "Actions" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <div className="text-3xl opacity-30">📭</div>
                    <p className="mt-2 font-medium text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi", ru: "Данные не найдены", en: "No data found" })}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi. Filterni o'zgartirib ko'ring.", ru: "Данные не найдены. Попробуйте изменить фильтр.", en: "No data found. Try changing the filter." })}</p>
                  </td>
                </tr>
              ) : (
                shown.map((g, i) => (
                  <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-slate-400">{(curPage - 1) * pageSize + i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: groupColor(g.id, g.color) }} />
                        <Link href={`/groups/${g.id}`} className="font-semibold text-brand-700 hover:underline dark:text-brand-300">{g.name}</Link>
                        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", statusTone[g.status] ?? statusTone.PLANNED)}>{statusLabel(g.status, locale)}</span>
                      </div>
                      {/* Izoh (kament) — guruh nomi ostida */}
                      {g.note && (
                        <div className="mt-1 flex max-w-[280px] items-start gap-1 text-[11px] leading-snug text-amber-600 dark:text-amber-400" title={g.note}>
                          <Icon name="info" className="mt-px h-3 w-3 shrink-0" />
                          <span className="line-clamp-2">{g.note}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{g.program}</td>
                    <td className="px-4 py-3 text-slate-500">{g.level ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">{daysLabel(g.weekdays, locale)}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">{g.startTime ? `${g.startTime}${g.endTime ? "–" + g.endTime : ""}` : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-500">{g.groupTime || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-500">{g.groupEndTime || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-brand-500/15 px-2 py-0.5 text-xs font-bold text-brand-600 dark:text-brand-300">{g.students} / {g.capacity}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{g.teacherName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canCreate && <GroupActiveToggle id={g.id} active={g.status === "ACTIVE"} locale={locale} />}
                        <Link href={`/groups/${g.id}`} title={tr(locale, { uz: "Batafsil", ru: "Подробнее", en: "Details" })} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"><Icon name="eye" className="h-4 w-4" /></Link>
                        {canCreate && (
                          <>
                            <EditGroupButton compact group={editDataOf(g)} programs={programs} teachers={teachers} locale={locale} />
                            <DeleteGroupBtn id={g.id} name={g.name} locale={locale} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: sahifa hajmi + navigatsiya */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Icon name="listView" className="h-4 w-4" />
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n} {tr(locale, { uz: "qatorda", ru: "строк", en: "rows" })}</option>)}
            </select>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 text-sm">
              <PageBtn disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}>‹</PageBtn>
              <span className="px-2 text-xs text-slate-500 dark:text-slate-400">{curPage} / {totalPages}</span>
              <PageBtn disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)}>›</PageBtn>
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      {canCreate && (
        <button onClick={() => setAddOpen(true)} title={tr(locale, { uz: "Yangi guruh", ru: "Новая группа", en: "New group" })} className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-pop transition hover:scale-105 hover:bg-brand-700">
          <Icon name="plus" className="h-5 w-5" />
        </button>
      )}

      <NewGroupForm locale={locale} programs={programs} teachers={teachers} rooms={roomOptions} open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function SortableTh({ label, active, dir, onClick }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  return (
    <th className="px-4 py-3">
      <button onClick={onClick} className={cn("flex items-center gap-1 uppercase tracking-wider transition", active ? "text-brand-600 dark:text-brand-300" : "hover:text-slate-700 dark:hover:text-slate-200")}>
        {label}
        <span className={cn("text-[10px]", active ? "opacity-100" : "opacity-30")}>{active && dir === "desc" ? "↓" : "↑"}</span>
      </button>
    </th>
  );
}

function FilterSelect({ value, onChange, placeholder, options, allowEmpty = true }: { value: string; onChange: (v: string) => void; placeholder: string; options: { v: string; label: string }[]; allowEmpty?: boolean }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-10 appearance-none rounded-lg border bg-white pl-3 pr-8 text-sm outline-none transition focus:border-brand-400 dark:bg-slate-800 dark:text-slate-100",
          value ? "border-brand-300 text-slate-800 dark:border-brand-500/40" : "border-slate-200 text-slate-500 dark:border-slate-700"
        )}
      >
        {allowEmpty && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
      <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

function TimeFilter({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className={cn("flex h-10 items-center rounded-lg border bg-white px-2.5 dark:bg-slate-800", value ? "border-brand-300 dark:border-brand-500/40" : "border-slate-200 dark:border-slate-700")}>
      <span className="mr-1.5 whitespace-nowrap text-xs text-slate-400">{label}</span>
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)} className="w-[70px] bg-transparent text-sm text-slate-800 outline-none dark:text-slate-100" />
      {value && <button onClick={() => onChange("")} className="ml-0.5 text-slate-400 hover:text-slate-600">✕</button>}
    </div>
  );
}

function PageBtn({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800">
      {children}
    </button>
  );
}

// VGroup → EditGroupData (tahrirlash formasi uchun)
function editDataOf(g: VGroup): EditGroupData {
  return {
    id: g.id, name: g.name, programId: g.programId, teacherId: g.teacherId,
    levelCode: g.level, color: g.color, format: g.format, onlineLink: g.onlineLink, room: g.room,
    status: g.status, capacity: g.capacity, startDate: g.startDate, endDate: g.endDate,
    weekdays: g.weekdays.length ? g.weekdays.join(",") : null,
    startTime: g.startTime, endTime: g.endTime, note: g.note,
  };
}

// iPhone uslubidagi on/off toggle — guruhni faol/nofaol qiladi
function GroupActiveToggle({ id, active, locale }: { id: string; active: boolean; locale: Locale }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [on, setOn] = useState(active);
  useEffect(() => setOn(active), [active]);

  const toggle = () => {
    const next = !on;
    setOn(next); // optimistik
    start(async () => {
      const r = await setGroupActive(id, next);
      if (r.ok) router.refresh();
      else setOn(!next); // rollback
    });
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      disabled={pending}
      title={on ? tr(locale, { uz: "Faol", ru: "Активна", en: "Active" }) : tr(locale, { uz: "Nofaol", ru: "Неактивна", en: "Inactive" })}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60",
        on ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
      )}
    >
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

function DeleteGroupBtn({ id, name, locale }: { id: string; name: string; locale: Locale }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const onDelete = () => {
    if (!window.confirm(tr(locale, {
      uz: `"${name}" guruhini o'chirasizmi? O'quvchilar biriktiruvi va darslar ham o'chadi.`,
      ru: `Удалить группу "${name}"? Записи учеников и уроки тоже будут удалены.`,
      en: `Delete group "${name}"? Student enrollments and lessons will also be deleted.`,
    }))) return;
    start(async () => {
      const r = await deleteGroup(id);
      if (r.ok) router.refresh();
    });
  };
  return (
    <button onClick={onDelete} disabled={pending} title={tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete" })}
      className="grid h-8 w-8 place-items-center rounded-lg text-rose-500 transition hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-500/10">
      <Icon name="trash" className="h-4 w-4" />
    </button>
  );
}
