"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import type { Lens } from "./GraphView";

interface PickTask { id: string; title: string; status: string; tag: string | null }

// taskIds: null = barcha eslatmalar (standart xaritalar); massiv = faqat biriktirilganlar (maxsus xarita)
interface SavedMap { id: string; name: string; lens: Lens; taskIds: string[] | null; archived: boolean; builtin?: boolean }

const LENS_OPTS: { v: Lens; label: { uz: string; ru: string; en: string } }[] = [
  { v: "all", label: { uz: "To'liq", ru: "Полная", en: "Full" } },
  { v: "student", label: { uz: "O'quvchi bo'yicha", ru: "По ученику", en: "By student" } },
  { v: "group", label: { uz: "Guruh bo'yicha", ru: "По группе", en: "By group" } },
  { v: "staff", label: { uz: "Mas'ul bo'yicha", ru: "По ответственному", en: "By assignee" } },
];

// Standart xaritalarning nomlari — ID bo'yicha lokalizatsiya (localStorage'da uz saqlanadi)
const DEFAULT_NAMES: Record<string, { uz: string; ru: string; en: string }> = {
  all: { uz: "To'liq xarita", ru: "Полная карта", en: "Full map" },
  "by-student": { uz: "O'quvchi bo'yicha", ru: "По ученику", en: "By student" },
  "by-group": { uz: "Guruh bo'yicha", ru: "По группе", en: "By group" },
  "by-staff": { uz: "Mas'ul bo'yicha", ru: "По ответственному", en: "By assignee" },
};

function defaults(): SavedMap[] {
  return [
    { id: "all", name: "To'liq xarita", lens: "all", taskIds: null, archived: false, builtin: true },
    { id: "by-student", name: "O'quvchi bo'yicha", lens: "student", taskIds: null, archived: false },
    { id: "by-group", name: "Guruh bo'yicha", lens: "group", taskIds: null, archived: false },
    { id: "by-staff", name: "Mas'ul bo'yicha", lens: "staff", taskIds: null, archived: false },
  ];
}
const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "m" + Date.now());

export default function MapManager({ kind, locale, tasks, onSelect }: {
  kind: string; locale: Locale; tasks: PickTask[]; onSelect: (lens: Lens, taskIds: string[] | null) => void;
}) {
  // Standart xarita bo'lsa — nomini lokalizatsiya qiladi, aks holda foydalanuvchi kiritgan nom
  const mapName = (m: SavedMap) => (DEFAULT_NAMES[m.id] ? tr(locale, DEFAULT_NAMES[m.id]) : m.name);
  const KEY = `glive:maps:${kind}`;
  const [maps, setMaps] = useState<SavedMap[]>(defaults);
  const [activeId, setActiveId] = useState("all");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLens, setNewLens] = useState<Lens>("all");
  const loaded = useRef(false);

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length) setMaps(arr); } } catch {}
    loaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(KEY, JSON.stringify(maps)); } catch {}
  }, [maps, KEY]);

  const active = maps.filter((m) => !m.archived);
  const archived = maps.filter((m) => m.archived);
  const activeMap = maps.find((m) => m.id === activeId) ?? maps[0];
  const isCustom = !!activeMap && activeMap.taskIds !== null;

  const select = (m: SavedMap) => { setActiveId(m.id); onSelect(m.lens, m.taskIds); };
  const resetToAll = () => { setActiveId("all"); onSelect("all", null); };

  function createMap() {
    // Yangi xarita — BO'SH boshlanadi (taskIds: [])
    const m: SavedMap = { id: newId(), name: newName.trim() || tr(locale, { uz: "Yangi xarita", ru: "Новая карта", en: "New map" }), lens: newLens, taskIds: [], archived: false };
    setMaps((p) => [...p, m]);
    setShowNew(false); setNewName(""); setNewLens("all");
    setActiveId(m.id); onSelect(m.lens, m.taskIds);
  }
  const archiveMap = (id: string) => { setMaps((p) => p.map((m) => m.id === id ? { ...m, archived: true } : m)); setMenuId(null); if (activeId === id) resetToAll(); };
  const restoreMap = (id: string) => setMaps((p) => p.map((m) => m.id === id ? { ...m, archived: false } : m));
  const deleteMap = (id: string) => { setMaps((p) => p.filter((m) => m.id !== id)); setMenuId(null); setShowArchive(false); if (activeId === id) resetToAll(); };

  // Maxsus xaritaga eslatma biriktirish
  function setMembership(ids: string[]) {
    setMaps((p) => p.map((m) => m.id === activeId ? { ...m, taskIds: ids } : m));
    onSelect(activeMap.lens, ids);
  }

  const chip = (on: boolean) => cn(
    "flex items-center rounded-full border text-sm font-medium transition",
    on ? "border-brand-600 bg-brand-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/60"
  );

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      {active.map((m) => (
        <div key={m.id} className="relative">
          <div className={chip(activeId === m.id)}>
            <button onClick={() => select(m)} className="py-1.5 pl-3.5 pr-1.5">
              {mapName(m)}
              {m.taskIds !== null && <span className="ml-1 rounded-full bg-white/25 px-1.5 text-[10px] font-bold">{m.taskIds.length}</span>}
            </button>
            {!m.builtin && (
              <button onClick={() => setMenuId(menuId === m.id ? null : m.id)} className="rounded-r-full py-1.5 pl-0.5 pr-2.5 text-xs opacity-60 hover:opacity-100" aria-label={tr(locale, { uz: "Xarita menyusi", ru: "Меню карты", en: "Map menu" })}>⋯</button>
            )}
          </div>
          {menuId === m.id && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
              <div className="absolute left-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-pop dark:border-slate-700 dark:bg-slate-800">
                <button onClick={() => archiveMap(m.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700">📥 {tr(locale, { uz: "Arxivlash", ru: "Архивировать", en: "Archive" })}</button>
                <button onClick={() => deleteMap(m.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40">🗑 {tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete" })}</button>
              </div>
            </>
          )}
        </div>
      ))}

      {/* Yangi xarita */}
      <div className="relative">
        <button onClick={() => { setShowNew((v) => !v); setShowArchive(false); }} className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-600 dark:text-slate-400">
          + {tr(locale, { uz: "Yangi xarita", ru: "Новая карта", en: "New map" })}
        </button>
        {showNew && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowNew(false)} />
            <div className="absolute left-0 top-full z-20 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-3.5 shadow-pop dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-2.5">
                <label className="mb-1 block text-[11px] font-medium text-slate-400">{tr(locale, { uz: "Xarita nomi", ru: "Название карты", en: "Map name" })}</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus placeholder={tr(locale, { uz: "Masalan: Muhim ishlar", ru: "Например: Важные дела", en: "e.g. Important tasks" })} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
              </div>
              <div className="mb-2.5">
                <label className="mb-1 block text-[11px] font-medium text-slate-400">{tr(locale, { uz: "Ko'rinish (linza)", ru: "Вид (линза)", en: "View (lens)" })}</label>
                <select value={newLens} onChange={(e) => setNewLens(e.target.value as Lens)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                  {LENS_OPTS.map((o) => <option key={o.v} value={o.v}>{tr(locale, o.label)}</option>)}
                </select>
              </div>
              <p className="mb-3 text-[11px] text-slate-400">{tr(locale, { uz: "Xarita bo'sh ochiladi — keyin unga eslatma biriktirasiz.", ru: "Карта откроется пустой — затем прикрепите к ней напоминания.", en: "The map opens empty — then attach reminders to it." })}</p>
              <div className="flex gap-2">
                <button onClick={() => setShowNew(false)} className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300">{tr(locale, { uz: "Bekor", ru: "Отмена", en: "Cancel" })}</button>
                <button onClick={createMap} className="flex-[1.4] rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700">{tr(locale, { uz: "Yaratish", ru: "Создать", en: "Create" })}</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Maxsus xaritaga eslatma biriktirish */}
      {isCustom && (
        <button onClick={() => setPickerOpen(true)} className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-300">
          ＋ {tr(locale, { uz: "Eslatma biriktirish", ru: "Прикрепить напоминание", en: "Attach reminder" })}
        </button>
      )}

      {/* Arxiv */}
      {archived.length > 0 && (
        <div className="relative ml-auto">
          <button onClick={() => { setShowArchive((v) => !v); setShowNew(false); }} className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400">
            🗄 {tr(locale, { uz: "Arxiv", ru: "Архив", en: "Archive" })} <span className="rounded-full bg-slate-200 px-1.5 text-xs dark:bg-slate-700">{archived.length}</span>
          </button>
          {showArchive && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowArchive(false)} />
              <div className="absolute right-0 top-full z-20 mt-1.5 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-pop dark:border-slate-700 dark:bg-slate-800">
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{tr(locale, { uz: "Arxivlangan xaritalar", ru: "Архивированные карты", en: "Archived maps" })}</div>
                {archived.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-600 dark:text-slate-300">{mapName(m)}</span>
                    <button onClick={() => restoreMap(m.id)} className="shrink-0 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">{tr(locale, { uz: "Tiklash", ru: "Восстановить", en: "Restore" })}</button>
                    <button onClick={() => deleteMap(m.id)} className="shrink-0 text-xs text-rose-500 hover:underline" title={tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete" })}>✕</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {pickerOpen && isCustom && (
        <TaskPicker
          tasks={tasks}
          locale={locale}
          selected={activeMap.taskIds ?? []}
          title={mapName(activeMap)}
          onClose={() => setPickerOpen(false)}
          onSave={(ids) => { setMembership(ids); setPickerOpen(false); }}
        />
      )}
    </div>
  );
}

// ── Eslatma tanlash oynasi ──
function TaskPicker({ tasks, locale, selected, title, onClose, onSave }: {
  tasks: PickTask[]; locale: Locale; selected: string[]; title: string; onClose: () => void; onSave: (ids: string[]) => void;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set(selected));
  const [q, setQ] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? tasks.filter((t) => t.title.toLowerCase().includes(s) || (t.tag ?? "").toLowerCase().includes(s)) : tasks;
  }, [tasks, q]);

  const toggle = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-slate-200 bg-white shadow-pop dark:border-slate-700 dark:bg-slate-900" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Eslatma biriktirish", ru: "Прикрепить напоминание", en: "Attach reminder" })}</h3>
            <p className="text-xs text-slate-400">{tr(locale, { uz: `«${title}» xaritasiga`, ru: `к карте «${title}»`, en: `to map «${title}»` })} · {sel.size} {tr(locale, { uz: "tanlangan", ru: "выбрано", en: "selected" })}</p>
          </div>
          <button onClick={onClose} className="text-lg text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="border-b border-slate-100 px-5 py-2.5 dark:border-slate-800">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr(locale, { uz: "Eslatma qidirish...", ru: "Поиск напоминаний...", en: "Search reminders..." })} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">{tr(locale, { uz: "Eslatma topilmadi", ru: "Напоминания не найдены", en: "No reminders found" })}</p>
          ) : shown.map((t) => (
            <label key={t.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
              <input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} className="h-4 w-4 shrink-0 rounded border-slate-300 accent-brand-600" />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{t.title}</span>
              {t.tag && <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{t.tag}</span>}
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3.5 dark:border-slate-800">
          <button onClick={() => setSel(new Set())} className="text-sm text-slate-400 hover:text-slate-600">{tr(locale, { uz: "Tozalash", ru: "Очистить", en: "Clear" })}</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300">{tr(locale, { uz: "Bekor", ru: "Отмена", en: "Cancel" })}</button>
            <button onClick={() => onSave([...sel])} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">{tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save" })} ({sel.size})</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
