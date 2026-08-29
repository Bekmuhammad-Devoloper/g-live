"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";
import { createBlockTest, createTestType, type FormState } from "./actions";

export interface VBlockTest {
  id: string; title: string; type: string; status: string; date: string; startTime: string | null;
  durationMin: number; responsible: string | null; groups: string[];
}
export interface VTestType {
  id: string; name: string; code: string | null; durationMin: number; courses: string[]; active: boolean; createdAt: string;
}
interface Opt { id: string; name: string }

const TYPE_DICT: Record<string, { uz: string; ru: string; en: string; de: string }> = {
  KIRISH: { uz: "Kirish", ru: "Вводный", en: "Entry", de: "Eingang" },
  BLOCK: { uz: "Blok", ru: "Блок", en: "Block", de: "Block" },
  YAKUNIY: { uz: "Yakuniy", ru: "Итоговый", en: "Final", de: "Abschluss" },
};
const typeLabel = (locale: Locale, code: string) => (TYPE_DICT[code] ? tr(locale, TYPE_DICT[code]) : code);
const TYPE_TONE: Record<string, string> = {
  KIRISH: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  BLOCK: "bg-brand-500/15 text-brand-600 dark:text-brand-300",
  YAKUNIY: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
};
const STATUS_DICT: Record<string, { uz: string; ru: string; en: string; de: string }> = {
  PLANNED: { uz: "Rejalashtirilgan", ru: "Запланирован", en: "Planned", de: "Geplant" },
  ACTIVE: { uz: "Faol", ru: "Активный", en: "Active", de: "Aktiv" },
  FINISHED: { uz: "Tugagan", ru: "Завершён", en: "Finished", de: "Abgeschlossen" },
};
const statusLabel = (locale: Locale, code: string) => (STATUS_DICT[code] ? tr(locale, STATUS_DICT[code]) : code);
const STATUS_TONE: Record<string, string> = {
  PLANNED: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  ACTIVE: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  FINISHED: "bg-slate-400/20 text-slate-500",
};

export default function TestsWorkspace({ exams, types, canCreate, staff, groups, programs, locale }: {
  exams: VBlockTest[]; types: VTestType[]; canCreate: boolean; staff: Opt[]; groups: Opt[]; programs: Opt[]; locale: Locale;
}) {
  const [tab, setTab] = useState<"exams" | "types">("exams");
  const [addExam, setAddExam] = useState(false);
  const [addType, setAddType] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Blok test", ru: "Блочный тест", en: "Block test", de: "Blocktest" })}</h1>
        <span className="text-sm text-slate-400">{tr(locale, { uz: "Kirish, blok va yakuniy imtihonlar", ru: "Вводные, блочные и итоговые экзамены", en: "Entry, block and final exams", de: "Eingangs-, Block- und Abschlussprüfungen" })}</span>
      </div>

      {/* Tablar + qo'shish tugmasi (yonma-yon) */}
      <div className="flex flex-wrap items-center gap-1.5">
        <TabBtn active={tab === "exams"} onClick={() => setTab("exams")}>{tr(locale, { uz: "Imtihonlar", ru: "Экзамены", en: "Exams", de: "Prüfungen" })} <Count n={exams.length} /></TabBtn>
        <TabBtn active={tab === "types"} onClick={() => setTab("types")}>{tr(locale, { uz: "Test turlari", ru: "Типы тестов", en: "Test types", de: "Testarten" })} <Count n={types.length} /></TabBtn>
        {canCreate && (
          <button
            onClick={() => (tab === "exams" ? setAddExam(true) : setAddType(true))}
            className="ml-auto flex h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            <Icon name="plus" className="h-4 w-4" /> {tab === "exams" ? tr(locale, { uz: "Imtihon qo'shish", ru: "Добавить экзамен", en: "Add exam", de: "Prüfung hinzufügen" }) : tr(locale, { uz: "Tur qo'shish", ru: "Добавить тип", en: "Add type", de: "Typ hinzufügen" })}
          </button>
        )}
      </div>

      {tab === "exams" ? <ExamsTable exams={exams} locale={locale} /> : <TypesTable types={types} locale={locale} />}

      {addExam && <NewBlockTestForm staff={staff} groups={groups} locale={locale} onClose={() => setAddExam(false)} />}
      {addType && <NewTestTypeForm programs={programs} locale={locale} onClose={() => setAddType(false)} />}
    </div>
  );
}

/* ───────── Imtihonlar jadvali ───────── */
function ExamsTable({ exams, locale }: { exams: VBlockTest[]; locale: Locale }) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? exams.filter((e) => `${e.title} ${e.responsible ?? ""} ${e.groups.join(" ")}`.toLowerCase().includes(q)) : exams;
  }, [exams, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, totalPages);
  const shown = filtered.slice((cur - 1) * pageSize, cur * pageSize);

  return (
    <TableShell
      locale={locale}
      search={search} setSearch={setSearch} total={filtered.length}
      pageSize={pageSize} setPageSize={setPageSize} page={cur} setPage={setPage} totalPages={totalPages}
      minWidth={1040}
      head={<tr>
        <th className="w-12 px-4 py-3">№</th><th className="px-4 py-3">{tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Turi", ru: "Тип", en: "Type", de: "Typ" })}</th>
        <th className="px-4 py-3">{tr(locale, { uz: "Holati", ru: "Статус", en: "Status", de: "Status" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Sana", ru: "Дата", en: "Date", de: "Datum" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Boshlanish vaqti", ru: "Время начала", en: "Start time", de: "Startzeit" })}</th>
        <th className="px-4 py-3">{tr(locale, { uz: "Davomiyligi (daqiqa)", ru: "Длительность (мин)", en: "Duration (min)", de: "Dauer (Min.)" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Mas'ul xodim", ru: "Ответственный", en: "Responsible", de: "Verantwortlich" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Guruhlar", ru: "Группы", en: "Groups", de: "Gruppen" })}</th>
      </tr>}
      colSpan={9} empty={shown.length === 0}
    >
      {shown.map((e, i) => (
        <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
          <td className="px-4 py-3 text-slate-400">{(cur - 1) * pageSize + i + 1}</td>
          <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{e.title}</td>
          <td className="px-4 py-3"><span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", TYPE_TONE[e.type] ?? TYPE_TONE.BLOCK)}>{typeLabel(locale, e.type)}</span></td>
          <td className="px-4 py-3"><span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", STATUS_TONE[e.status] ?? STATUS_TONE.PLANNED)}>{statusLabel(locale, e.status)}</span></td>
          <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">{e.date || "—"}</td>
          <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">{e.startTime || "—"}</td>
          <td className="px-4 py-3 tabular-nums text-slate-500">{e.durationMin}</td>
          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{e.responsible || "—"}</td>
          <td className="px-4 py-3">
            <div className="flex flex-wrap gap-1">
              {e.groups.length === 0 ? <span className="text-xs text-slate-400">—</span> : e.groups.map((g, k) => (
                <span key={k} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700/50 dark:text-slate-300">{g}</span>
              ))}
            </div>
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

/* ───────── Test turlari jadvali ───────── */
function TypesTable({ types, locale }: { types: VTestType[]; locale: Locale }) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? types.filter((t) => `${t.name} ${t.code ?? ""} ${t.courses.join(" ")}`.toLowerCase().includes(q)) : types;
  }, [types, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, totalPages);
  const shown = filtered.slice((cur - 1) * pageSize, cur * pageSize);

  return (
    <TableShell
      locale={locale}
      search={search} setSearch={setSearch} total={filtered.length}
      pageSize={pageSize} setPageSize={setPageSize} page={cur} setPage={setPage} totalPages={totalPages}
      minWidth={860}
      head={<tr>
        <th className="w-12 px-4 py-3">№</th><th className="px-4 py-3">{tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Kodi", ru: "Код", en: "Code", de: "Code" })}</th>
        <th className="px-4 py-3">{tr(locale, { uz: "Davomiyligi (daqiqa)", ru: "Длительность (мин)", en: "Duration (min)", de: "Dauer (Min.)" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Kurslar", ru: "Курсы", en: "Courses", de: "Kurse" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Holati", ru: "Статус", en: "Status", de: "Status" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Qo'shilgan sana", ru: "Дата добавления", en: "Added date", de: "Hinzugefügt am" })}</th>
      </tr>}
      colSpan={7} empty={shown.length === 0}
    >
      {shown.map((t, i) => (
        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
          <td className="px-4 py-3 text-slate-400">{(cur - 1) * pageSize + i + 1}</td>
          <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{t.name}</td>
          <td className="px-4 py-3 font-mono text-xs text-slate-500">{t.code || "—"}</td>
          <td className="px-4 py-3 tabular-nums text-slate-500">{t.durationMin}</td>
          <td className="px-4 py-3">
            <div className="flex flex-wrap gap-1">
              {t.courses.length === 0 ? <span className="text-xs text-slate-400">—</span> : t.courses.map((c, k) => (
                <span key={k} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700/50 dark:text-slate-300">{c}</span>
              ))}
            </div>
          </td>
          <td className="px-4 py-3"><span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", t.active ? STATUS_TONE.ACTIVE : STATUS_TONE.FINISHED)}>{t.active ? tr(locale, { uz: "Faol", ru: "Активный", en: "Active", de: "Aktiv" }) : tr(locale, { uz: "Nofaol", ru: "Неактивный", en: "Inactive", de: "Inaktiv" })}</span></td>
          <td className="px-4 py-3 tabular-nums text-slate-500">{t.createdAt}</td>
        </tr>
      ))}
    </TableShell>
  );
}

/* ───────── Umumiy jadval qobig'i ───────── */
function TableShell({ search, setSearch, total, pageSize, setPageSize, page, setPage, totalPages, head, children, colSpan, empty, minWidth, locale }: {
  search: string; setSearch: (v: string) => void; total: number;
  pageSize: number; setPageSize: (n: number) => void; page: number; setPage: (n: number) => void; totalPages: number;
  head: React.ReactNode; children: React.ReactNode; colSpan: number; empty: boolean; minWidth: number; locale: Locale;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative ml-auto">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr(locale, { uz: "Qidirish", ru: "Поиск", en: "Search", de: "Suchen" })} className="h-10 w-60 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-end border-b border-slate-100 px-4 py-2 dark:border-slate-800">
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{tr(locale, { uz: "Umumiy soni", ru: "Всего", en: "Total", de: "Gesamt" })}: {total}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" style={{ minWidth }}>
            <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">{head}</thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {empty ? (
                <tr><td colSpan={colSpan} className="px-4 py-16 text-center">
                  <div className="text-3xl opacity-30">📭</div>
                  <p className="mt-2 font-medium text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi", ru: "Данные не найдены", en: "No data found", de: "Keine Daten gefunden" })}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi. Filterni o'zgartirib ko'ring.", ru: "Данные не найдены. Попробуйте изменить фильтр.", en: "No data found. Try changing the filter.", de: "Keine Daten gefunden. Versuchen Sie, den Filter zu ändern." })}</p>
                </td></tr>
              ) : children}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Icon name="listView" className="h-4 w-4" />
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n} {tr(locale, { uz: "qator", ru: "строк", en: "rows", de: "Zeilen" })}</option>)}
            </select>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 text-sm">
              <PageBtn disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</PageBtn>
              <span className="px-2 text-xs text-slate-500 dark:text-slate-400">{page} / {totalPages}</span>
              <PageBtn disabled={page >= totalPages} onClick={() => setPage(page + 1)}>›</PageBtn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────── Imtihon qo'shish drawer ───────── */
function NewBlockTestForm({ staff, groups, locale, onClose }: { staff: Opt[]; groups: Opt[]; locale: Locale; onClose: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createBlockTest, {});
  const [mounted, setMounted] = useState(false);
  const [gsel, setGsel] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => { if (state.ok) { formRef.current?.reset(); setGsel([]); onClose(); } /* eslint-disable-next-line */ }, [state.ok]);
  useDrawer(onClose);
  if (!mounted) return null;
  const toggleG = (id: string) => setGsel((d) => d.includes(id) ? d.filter((x) => x !== id) : [...d, id]);

  return createPortal(
    <Drawer title={tr(locale, { uz: "Imtihon qo'shish", ru: "Добавить экзамен", en: "Add exam", de: "Prüfung hinzufügen" })} locale={locale} formRef={formRef} action={action} onClose={onClose} pending={pending} error={state.error}>
      <Field label={tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" })} required><input name="title" required placeholder={tr(locale, { uz: "A1 blok imtihon", ru: "A1 блочный экзамен", en: "A1 block exam", de: "A1-Blockprüfung" })} className={INP} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={tr(locale, { uz: "Turi", ru: "Тип", en: "Type", de: "Typ" })}><select name="type" className={INP} defaultValue="BLOCK"><option value="KIRISH">{tr(locale, { uz: "Kirish", ru: "Вводный", en: "Entry", de: "Eingang" })}</option><option value="BLOCK">{tr(locale, { uz: "Blok", ru: "Блок", en: "Block", de: "Block" })}</option><option value="YAKUNIY">{tr(locale, { uz: "Yakuniy", ru: "Итоговый", en: "Final", de: "Abschluss" })}</option></select></Field>
        <Field label={tr(locale, { uz: "Holati", ru: "Статус", en: "Status", de: "Status" })}><select name="status" className={INP} defaultValue="PLANNED"><option value="PLANNED">{tr(locale, { uz: "Rejalashtirilgan", ru: "Запланирован", en: "Planned", de: "Geplant" })}</option><option value="ACTIVE">{tr(locale, { uz: "Faol", ru: "Активный", en: "Active", de: "Aktiv" })}</option><option value="FINISHED">{tr(locale, { uz: "Tugagan", ru: "Завершён", en: "Finished", de: "Abgeschlossen" })}</option></select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={tr(locale, { uz: "Sana", ru: "Дата", en: "Date", de: "Datum" })}><input name="date" type="date" className={INP} /></Field>
        <Field label={tr(locale, { uz: "Boshlanish vaqti", ru: "Время начала", en: "Start time", de: "Startzeit" })}><input name="startTime" type="time" className={INP} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={tr(locale, { uz: "Davomiyligi (daqiqa)", ru: "Длительность (мин)", en: "Duration (min)", de: "Dauer (Min.)" })}><input name="durationMin" type="number" min="0" max="1000" defaultValue={60} className={INP} /></Field>
        <Field label={tr(locale, { uz: "Mas'ul xodim", ru: "Ответственный", en: "Responsible", de: "Verantwortlich" })}><select name="responsibleId" className={INP} defaultValue=""><option value="">—</option>{staff.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      </div>
      <Field label={tr(locale, { uz: "Guruhlar", ru: "Группы", en: "Groups", de: "Gruppen" })}>
        <ChipSelect options={groups} selected={gsel} onToggle={toggleG} locale={locale} />
        <input type="hidden" name="groupIds" value={gsel.join(",")} />
      </Field>
    </Drawer>, document.body);
}

/* ───────── Tur qo'shish drawer ───────── */
function NewTestTypeForm({ programs, locale, onClose }: { programs: Opt[]; locale: Locale; onClose: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createTestType, {});
  const [mounted, setMounted] = useState(false);
  const [csel, setCsel] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => { if (state.ok) { formRef.current?.reset(); setCsel([]); onClose(); } /* eslint-disable-next-line */ }, [state.ok]);
  useDrawer(onClose);
  if (!mounted) return null;
  const toggleC = (id: string) => setCsel((d) => d.includes(id) ? d.filter((x) => x !== id) : [...d, id]);

  return createPortal(
    <Drawer title={tr(locale, { uz: "Test turi qo'shish", ru: "Добавить тип теста", en: "Add test type", de: "Testtyp hinzufügen" })} locale={locale} formRef={formRef} action={action} onClose={onClose} pending={pending} error={state.error}>
      <Field label={tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" })} required><input name="name" required placeholder={tr(locale, { uz: "Blok test A1", ru: "Блочный тест A1", en: "Block test A1", de: "Blocktest A1" })} className={INP} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={tr(locale, { uz: "Kodi", ru: "Код", en: "Code", de: "Code" })}><input name="code" placeholder="BT-A1" className={INP} /></Field>
        <Field label={tr(locale, { uz: "Davomiyligi (daqiqa)", ru: "Длительность (мин)", en: "Duration (min)", de: "Dauer (Min.)" })}><input name="durationMin" type="number" min="0" max="1000" defaultValue={60} className={INP} /></Field>
      </div>
      <Field label={tr(locale, { uz: "Kurslar", ru: "Курсы", en: "Courses", de: "Kurse" })}>
        <ChipSelect options={programs} selected={csel} onToggle={toggleC} locale={locale} />
        <input type="hidden" name="courseIds" value={csel.join(",")} />
      </Field>
    </Drawer>, document.body);
}

/* ───────── Umumiy UI bo'laklari ───────── */
const INP = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";

function useDrawer(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
}

function Drawer({ title, formRef, action, onClose, pending, error, children, locale }: { title: string; formRef: React.RefObject<HTMLFormElement | null>; action: (fd: FormData) => void; onClose: () => void; pending: boolean; error?: string; children: React.ReactNode; locale: Locale }) {
  return (
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <form ref={formRef} action={action} onMouseDown={(e) => e.stopPropagation()} className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[440px] max-w-[92%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">✕</button>
        </div>
        <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          {children}
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{error === "forbidden" ? tr(locale, { uz: "Ruxsat yo'q.", ru: "Нет доступа.", en: "No access.", de: "Kein Zugriff." }) : tr(locale, { uz: "Ma'lumotlar to'liq emas.", ru: "Данные заполнены не полностью.", en: "Data is incomplete.", de: "Die Daten sind unvollständig." })}</p>}
        </div>
        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">{tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel", de: "Abbrechen" })}</button>
          <button type="submit" disabled={pending} className="flex-[1.4] rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">{pending ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving...", de: "Wird gespeichert..." }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{label}{required && <span className="text-rose-500"> *</span>}</span>
      {children}
    </label>
  );
}

function ChipSelect({ options, selected, onToggle, locale }: { options: Opt[]; selected: string[]; onToggle: (id: string) => void; locale: Locale }) {
  if (options.length === 0) return <p className="text-xs text-slate-400">{tr(locale, { uz: "Variant yo'q", ru: "Нет вариантов", en: "No options", de: "Keine Optionen" })}</p>;
  return (
    <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <button key={o.id} type="button" onClick={() => onToggle(o.id)} className={cn("rounded-lg border px-2.5 py-1.5 text-xs font-medium transition", on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/5")}>
            {o.name}
          </button>
        );
      })}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition", active ? "bg-brand-600 text-white shadow-sm" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800")}>
      {children}
    </button>
  );
}
function Count({ n }: { n: number }) {
  return <span className="rounded-full bg-black/10 px-1.5 text-[11px] font-bold dark:bg-white/15">{n}</span>;
}
function PageBtn({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return <button onClick={onClick} disabled={disabled} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800">{children}</button>;
}
