"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../_components/Icon";
import { NewTaskForm, ToggleTask, TASK_TYPES } from "./TaskControls";
import { toggleTask, deleteTask } from "./actions";
import GraphView, { type Lens } from "./GraphView";
import MapManager from "./MapManager";

export interface VTask {
  id: string;
  title: string;
  note: string | null;
  tag: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  assignee: string | null;
  student: string | null;
  group: string | null;
  author: string | null;
  createdAt: string;
}
interface Opt { id: string; name: string }

interface Props {
  kind: "TASK" | "REMINDER";
  title: string;
  locale: Locale;
  tasks: VTask[];
  staff: Opt[];
  students: Opt[];
  groups: Opt[];
  mapOnly?: boolean; // faqat neyron xarita (Eslatmalar uchun)
}

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function endOfToday() { const d = new Date(); d.setHours(23, 59, 59, 999); return d; }

export default function TasksView({ kind, title, locale, tasks, staff, students, groups, mapOnly = false }: Props) {
  const [showFilter, setShowFilter] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [view, setView] = useState<"board" | "map">(mapOnly ? "map" : "board");
  const [lens, setLens] = useState<Lens>("all");
  const [selected, setSelected] = useState<VTask | null>(null);
  const [pending, startAction] = useTransition();
  const router = useRouter();
  const [fAssignee, setFAssignee] = useState("");
  const [fStudent, setFStudent] = useState("");
  const [fType, setFType] = useState("");
  const [fGroup, setFGroup] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [dFrom, setDFrom] = useState("");
  const [dTo, setDTo] = useState("");
  // Faol xarita a'zoligi: null = barcha eslatmalar; massiv = faqat biriktirilganlar
  const [mapTaskIds, setMapTaskIds] = useState<string[] | null>(null);

  const filtered = useMemo(() => {
    const from = dFrom ? new Date(dFrom + "T00:00:00") : null;
    const to = dTo ? new Date(dTo + "T23:59:59") : null;
    const memberSet = mapTaskIds ? new Set(mapTaskIds) : null;
    return tasks.filter((x) => {
      if (view === "map" && memberSet && !memberSet.has(x.id)) return false;
      if (fAssignee && x.assignee !== fAssignee) return false;
      if (fStudent && x.student !== fStudent) return false;
      if (fType && x.tag !== fType) return false;
      if (fGroup && x.group !== fGroup) return false;
      if (fStatus === "OPEN" && x.status === "DONE") return false;
      if (fStatus === "DONE" && x.status !== "DONE") return false;
      if ((from || to) && x.dueAt) {
        const d = new Date(x.dueAt);
        if (from && d < from) return false;
        if (to && d > to) return false;
      } else if ((from || to) && !x.dueAt) return false;
      return true;
    });
  }, [tasks, fAssignee, fStudent, fType, fGroup, fStatus, dFrom, dTo, view, mapTaskIds]);

  const cols = useMemo(() => {
    const t0 = startOfToday(), t1 = endOfToday();
    const open = filtered.filter((x) => x.status !== "DONE");
    return {
      overdue: open.filter((x) => x.dueAt && new Date(x.dueAt) < t0),
      today: open.filter((x) => x.dueAt && new Date(x.dueAt) >= t0 && new Date(x.dueAt) <= t1),
      future: open.filter((x) => !x.dueAt || new Date(x.dueAt) > t1),
      done: filtered.filter((x) => x.status === "DONE"),
    };
  }, [filtered]);

  const COLUMNS = [
    { key: "overdue", label: tr(locale, { uz: "O'tib ketgan", ru: "Просроченные", en: "Overdue", de: "Überfällig" }), bar: "bg-red-500", items: cols.overdue },
    { key: "today", label: tr(locale, { uz: "Bugun", ru: "Сегодня", en: "Today", de: "Heute" }), bar: "bg-emerald-500", items: cols.today },
    { key: "future", label: tr(locale, { uz: "Kelajak", ru: "Будущие", en: "Future", de: "Zukünftig" }), bar: "bg-blue-500", items: cols.future },
    { key: "done", label: tr(locale, { uz: "Bajarilgan", ru: "Выполнено", en: "Done", de: "Erledigt" }), bar: "bg-slate-400", items: cols.done },
  ] as const;

  function exportCsv() {
    const rows = [[
      tr(locale, { uz: "Sarlavha", ru: "Заголовок", en: "Title", de: "Titel" }),
      tr(locale, { uz: "Tur", ru: "Тип", en: "Type", de: "Typ" }),
      tr(locale, { uz: "Mas'ul", ru: "Ответственный", en: "Assignee", de: "Zuständig" }),
      tr(locale, { uz: "O'quvchi", ru: "Ученик", en: "Student", de: "Schüler" }),
      tr(locale, { uz: "Guruh", ru: "Группа", en: "Group", de: "Gruppe" }),
      tr(locale, { uz: "Muddat", ru: "Срок", en: "Due", de: "Fällig" }),
      tr(locale, { uz: "Holat", ru: "Статус", en: "Status", de: "Status" }),
    ]];
    filtered.forEach((x) => rows.push([x.title, x.tag ?? "", x.assignee ?? "", x.student ?? "", x.group ?? "", x.dueAt ?? "", x.status]));
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "topshiriqlar.csv"; a.click(); URL.revokeObjectURL(url);
    setShowMenu(false);
  }

  // Deterministik format (server va client bir xil chiqishi uchun — hydration mos keladi)
  const fmt = (iso: string) => {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const sel = "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-600 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";

  return (
    <div>
      {/* Sarlavha + amallar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{tr(locale, { uz: "Jami", ru: "Всего", en: "Total", de: "Gesamt" })}: {tasks.length} · {tr(locale, { uz: "Ochiq", ru: "Открыто", en: "Open", de: "Offen" })}: {tasks.filter((x) => x.status !== "DONE").length}</p>
        </div>
        <div className="flex items-center gap-2">
          {!mapOnly && (
            <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
              <button onClick={() => setView("board")} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition", view === "board" ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800")}>
                <Icon name="grid" className="h-4 w-4" /> {tr(locale, { uz: "Ustunlar", ru: "Столбцы", en: "Columns", de: "Spalten" })}
              </button>
              <button onClick={() => setView("map")} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition", view === "map" ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800")}>
                {tr(locale, { uz: "Bog'lanishlar grafi", ru: "Граф связей", en: "Graph view", de: "Graphenansicht" })}
              </button>
            </div>
          )}
          <button onClick={() => setShowFilter((v) => !v)} className={cn("flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition", showFilter ? "bg-brand-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300")}>
            <Icon name="filter" className="h-4 w-4" /> {tr(locale, { uz: "Filtr", ru: "Фильтр", en: "Filter", de: "Filter" })}
          </button>
          <NewTaskForm kind={kind} locale={locale} staff={staff} students={students} groups={groups} buttonLabel={tr(locale, { uz: "Qo'shish", ru: "Добавить", en: "Add", de: "Hinzufügen" })} />
          <div className="relative">
            <button onClick={() => setShowMenu((v) => !v)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400">⋮</button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full z-20 mt-1.5 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-pop dark:border-slate-700 dark:bg-slate-800">
                  <button onClick={exportCsv} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700">
                    <Icon name="download" className="h-4 w-4 text-slate-400" /> {tr(locale, { uz: "CSV eksport", ru: "CSV экспорт", en: "CSV export", de: "CSV-Export" })}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filtrlar */}
      {showFilter && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <select value={fAssignee} onChange={(e) => setFAssignee(e.target.value)} className={sel}><option value="">{tr(locale, { uz: "Mas'ul shaxs", ru: "Ответственный", en: "Assignee", de: "Zuständig" })}</option>{staff.map((x) => <option key={x.id} value={x.name}>{x.name}</option>)}</select>
          <select value={fStudent} onChange={(e) => setFStudent(e.target.value)} className={sel}><option value="">{tr(locale, { uz: "O'quvchi", ru: "Ученик", en: "Student", de: "Schüler" })}</option>{students.map((x) => <option key={x.id} value={x.name}>{x.name}</option>)}</select>
          <select value={fType} onChange={(e) => setFType(e.target.value)} className={sel}><option value="">{tr(locale, { uz: "Topshiriq turi", ru: "Тип задачи", en: "Task type", de: "Aufgabentyp" })}</option>{TASK_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}</select>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 dark:border-slate-700">
            <Icon name="calendar" className="h-4 w-4 text-slate-400" />
            <input type="date" value={dFrom} onChange={(e) => setDFrom(e.target.value)} className="h-9 bg-transparent text-sm text-slate-600 outline-none dark:text-slate-300" />
            <span className="text-slate-300">–</span>
            <input type="date" value={dTo} onChange={(e) => setDTo(e.target.value)} className="h-9 bg-transparent text-sm text-slate-600 outline-none dark:text-slate-300" />
          </div>
          <select value={fGroup} onChange={(e) => setFGroup(e.target.value)} className={sel}><option value="">{tr(locale, { uz: "Guruh", ru: "Группа", en: "Group", de: "Gruppe" })}</option>{groups.map((x) => <option key={x.id} value={x.name}>{x.name}</option>)}</select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={sel}><option value="">{tr(locale, { uz: "Holat: Barchasi", ru: "Статус: Все", en: "Status: All", de: "Status: Alle" })}</option><option value="OPEN">{tr(locale, { uz: "Jarayonda", ru: "В процессе", en: "In progress", de: "In Bearbeitung" })}</option><option value="DONE">{tr(locale, { uz: "Bajarilgan", ru: "Выполнено", en: "Done", de: "Erledigt" })}</option></select>
          {(fAssignee || fStudent || fType || fGroup || fStatus || dFrom || dTo) && (
            <button onClick={() => { setFAssignee(""); setFStudent(""); setFType(""); setFGroup(""); setFStatus(""); setDFrom(""); setDTo(""); }} className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-slate-600">{tr(locale, { uz: "Tozalash", ru: "Очистить", en: "Clear", de: "Zurücksetzen" })}</button>
          )}
        </div>
      )}

      {/* Bog'lanishlar grafi — boshqariladigan xaritalar (yangi / arxiv / o'chirish) */}
      {view === "map" && (
        <div>
          <MapManager kind={kind} locale={locale} tasks={tasks} onSelect={(l, ids) => { setLens(l); setMapTaskIds(ids); }} />
          <GraphView tasks={filtered} locale={locale} onSelect={setSelected} lens={lens} />
        </div>
      )}

      {/* Board */}
      {view === "board" && (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => (
          <div key={col.key} className="overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40">
            <div className={cn("h-1", col.bar)} />
            <div className="px-4 py-3 text-center">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">{col.label}</div>
              <div className="text-sm font-semibold text-slate-400">{col.items.length}</div>
            </div>
            <div className="max-h-[62vh] space-y-2 overflow-y-auto px-3 pb-3">
              {col.items.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">✓ {tr(locale, { uz: "Boshqa yo'q", ru: "Больше нет", en: "Nothing else", de: "Nichts weiter" })}</p>
              ) : (
                col.items.map((x) => (
                  <div key={x.id} onClick={() => setSelected(x)} className="cursor-pointer rounded-xl border border-slate-200/70 bg-white p-3 shadow-sm transition hover:border-brand-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex items-start gap-2.5">
                      <ToggleTask id={x.id} done={x.status === "DONE"} locale={locale} />
                      <div className="min-w-0 flex-1">
                        <div className={cn("text-sm font-medium", x.status === "DONE" ? "text-slate-400 line-through" : "text-slate-800 dark:text-slate-100")}>{x.title}</div>
                        {x.note && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{x.note}</p>}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                          {x.dueAt && <span className="text-slate-400">🕘 {fmt(x.dueAt)}</span>}
                          {x.tag && <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{x.tag}</span>}
                          {x.priority === "HIGH" && <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">{tr(locale, { uz: "Yuqori", ru: "Высокий", en: "High", de: "Hoch" })}</span>}
                          {x.assignee && <span className="text-slate-400">👤 {x.assignee}</span>}
                          {x.student && <span className="text-slate-400">🎓 {x.student}</span>}
                          {x.group && <span className="text-slate-400">📚 {x.group}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Batafsil oyna */}
      {selected && (
        <div className="fixed inset-0 z-[60]" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[360px] max-w-[86%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800">
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", selected.status === "DONE" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300")}>
                    {selected.status === "DONE" ? tr(locale, { uz: "Bajarilgan", ru: "Выполнено", en: "Done", de: "Erledigt" }) : tr(locale, { uz: "Jarayonda", ru: "В процессе", en: "In progress", de: "In Bearbeitung" })}
                  </span>
                  {selected.tag && <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{selected.tag}</span>}
                  {selected.priority === "HIGH" && <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">{tr(locale, { uz: "Yuqori", ru: "Высокий", en: "High", de: "Hoch" })}</span>}
                </div>
                <h3 className={cn("text-lg font-bold", selected.status === "DONE" ? "text-slate-400 line-through" : "text-slate-900 dark:text-slate-100")}>{selected.title}</h3>
              </div>
              <button onClick={() => setSelected(null)} className="shrink-0 text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto p-5">
              <DRow icon="clock" label={tr(locale, { uz: "Muddat", ru: "Срок", en: "Due", de: "Fällig" })} value={selected.dueAt ? fmt(selected.dueAt) : "—"} />
              <DRow icon="user" label={tr(locale, { uz: "Mas'ul shaxs", ru: "Ответственный", en: "Assignee", de: "Zuständig" })} value={selected.assignee ?? "—"} />
              <DRow icon="graduation" label={tr(locale, { uz: "O'quvchi", ru: "Ученик", en: "Student", de: "Schüler" })} value={selected.student ?? "—"} />
              <DRow icon="layers" label={tr(locale, { uz: "Guruh", ru: "Группа", en: "Group", de: "Gruppe" })} value={selected.group ?? "—"} />
              <DRow icon="download" label={tr(locale, { uz: "Tur", ru: "Тип", en: "Type", de: "Typ" })} value={selected.tag ?? "—"} />
              <DRow icon="history" label={tr(locale, { uz: "Yaratilgan", ru: "Создано", en: "Created", de: "Erstellt" })} value={`${fmt(selected.createdAt)}${selected.author ? " · " + selected.author : ""}`} />
              {selected.note && (
                <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {selected.note}
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 p-4 dark:border-slate-800">
              <button
                disabled={pending}
                onClick={() => startAction(async () => { await deleteTask(selected.id); setSelected(null); router.refresh(); })}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900"
              >
                🗑 {tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete", de: "Löschen" })}
              </button>
              <div className="flex gap-2">
                <button onClick={() => setSelected(null)} className="btn-ghost">{tr(locale, { uz: "Yopish", ru: "Закрыть", en: "Close", de: "Schließen" })}</button>
                <button
                  disabled={pending}
                  onClick={() => startAction(async () => { await toggleTask(selected.id); const ns = { ...selected, status: selected.status === "DONE" ? "OPEN" : "DONE" }; setSelected(ns); router.refresh(); })}
                  className="btn-primary"
                >
                  {selected.status === "DONE" ? tr(locale, { uz: "Qayta ochish", ru: "Открыть заново", en: "Reopen", de: "Wieder öffnen" }) : tr(locale, { uz: "Bajarildi", ru: "Выполнено", en: "Done", de: "Erledigt" }) + " ✓"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-50 py-2 last:border-0 dark:border-slate-800/50">
      <Icon name={icon} className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="w-32 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <span className="min-w-0 flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  );
}
