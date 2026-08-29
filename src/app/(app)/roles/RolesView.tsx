"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { exportRows } from "@/lib/export";
import { Icon } from "../_components/Icon";
import { PERM_GROUPS, ALL_PERM_KEYS } from "./permissions";
import { saveRole, deleteRole } from "./actions";

export interface VRole { id: string; name: string; description: string; department: string; permissions: string[]; bossOnly: boolean; staff: number }

// Bo'limlar (tartib + tanlash uchun) — oxirida "Boshqa" bo'limsizlar uchun
const DEPARTMENTS = ["Boshqaruv", "Sotuv bo'limi", "Marketing bo'limi", "Moliya bo'limi", "Administrativ", "Ta'lim bo'limi"] as const;
const DEPT_ICON: Record<string, string> = {
  "Boshqaruv": "shieldCheck",
  "Sotuv bo'limi": "megaphone",
  "Marketing bo'limi": "megaphone",
  "Moliya bo'limi": "wallet",
  "Administrativ": "users",
  "Ta'lim bo'limi": "graduation",
};

export default function RolesView({ roles, canManage, locale }: { roles: VRole[]; canManage: boolean; locale: Locale }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<VRole | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? roles.filter((r) => `${r.name} ${r.description} ${r.department}`.toLowerCase().includes(q)) : roles;
  }, [roles, search]);

  // Bo'limlar bo'yicha guruhlash (tartib: DEPARTMENTS, so'ng maxsus bo'limlar, oxirida bo'limsizlar)
  // Sentinel kalit — haqiqiy bo'lim nomi bilan to'qnashmasligi uchun maxsus belgi
  const OTHER = "__bolimsiz__";
  const grouped = useMemo(() => {
    const map = new Map<string, VRole[]>();
    for (const r of filtered) {
      const key = r.department?.trim() || OTHER;
      const arr = map.get(key); if (arr) arr.push(r); else map.set(key, [r]);
    }
    const order: string[] = [];
    for (const d of DEPARTMENTS) if (map.has(d)) order.push(d);
    for (const k of map.keys()) if (k !== OTHER && !order.includes(k)) order.push(k);
    if (map.has(OTHER)) order.push(OTHER);
    return order.map((k) => ({ key: k, label: k === OTHER ? tr(locale, { uz: "Bo'limsiz", ru: "Без отдела", en: "No department", de: "Keine Abteilung" }) : k, roles: map.get(k)! }));
  }, [filtered, locale]);

  const del = (id: string) => { if (confirm(tr(locale, { uz: "Rolni o'chirasizmi?", ru: "Удалить роль?", en: "Delete this role?", de: "Diese Rolle löschen?" }))) start(async () => { await deleteRole(id); router.refresh(); }); };

  const exportCsvNow = () => exportRows(
    tr(locale, { uz: "rollar", ru: "роли", en: "roles", de: "rollen" }),
    [
      { key: "name", label: tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" }) },
      { key: "description", label: tr(locale, { uz: "Izoh", ru: "Описание", en: "Description", de: "Beschreibung" }) },
      { key: "permissions", label: tr(locale, { uz: "Ruxsatlar soni", ru: "Кол-во разрешений", en: "Permissions count", de: "Anzahl der Berechtigungen" }) },
      { key: "bossOnly", label: tr(locale, { uz: "Faqat boss", ru: "Только босс", en: "Boss only", de: "Nur Chef" }) },
    ],
    filtered.map((r) => ({ name: r.name, description: r.description, permissions: r.permissions.length, bossOnly: r.bossOnly ? tr(locale, { uz: "Ha", ru: "Да", en: "Yes", de: "Ja" }) : tr(locale, { uz: "Yo'q", ru: "Нет", en: "No", de: "Nein" }) })),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Rollar", ru: "Роли", en: "Roles", de: "Rollen" })}</h1>

      <div className="flex flex-wrap items-center gap-2">
        {canManage && (
          <button onClick={() => { setEditing(null); setOpen(true); }} className="flex h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
            <Icon name="plus" className="h-4 w-4" /> {tr(locale, { uz: "Rol qo'shish", ru: "Добавить роль", en: "Add role", de: "Rolle hinzufügen" })}
          </button>
        )}
        <div className="relative ml-auto">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr(locale, { uz: "Qidiruv", ru: "Поиск", en: "Search", de: "Suchen" })} className="h-10 w-60 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
        </div>
        <button onClick={exportCsvNow} className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/60" title={tr(locale, { uz: "CSV yuklab olish", ru: "Скачать CSV", en: "Download CSV", de: "CSV herunterladen" })}>
          <Icon name="download" className="h-4 w-4" /> {tr(locale, { uz: "Eksport", ru: "Экспорт", en: "Export", de: "Export" })}
        </button>
      </div>

      <div className={cn("overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900", pending && "opacity-70")}>
        <div className="flex items-center justify-end border-b border-slate-100 px-4 py-2 dark:border-slate-800">
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{tr(locale, { uz: "Umumiy soni", ru: "Всего", en: "Total", de: "Gesamt" })}: {filtered.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="w-12 px-4 py-3">№</th><th className="px-4 py-3">{tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Izoh", ru: "Описание", en: "Description", de: "Beschreibung" })}</th>
                <th className="px-4 py-3 text-center">{tr(locale, { uz: "Ruxsatlar", ru: "Разрешения", en: "Permissions", de: "Berechtigungen" })}</th><th className="px-4 py-3 text-center">{tr(locale, { uz: "Xodimlar", ru: "Сотрудники", en: "Staff", de: "Mitarbeiter" })}</th>
                {canManage && <th className="px-4 py-3 text-right">{tr(locale, { uz: "Amallar", ru: "Действия", en: "Actions", de: "Aktionen" })}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr><td colSpan={canManage ? 6 : 5} className="px-4 py-14 text-center text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi", ru: "Данные не найдены", en: "No data found", de: "Keine Daten gefunden" })}</td></tr>
              ) : (() => {
                let no = 0;
                return grouped.map((g) => (
                  <Fragment key={g.key}>
                    <tr className="bg-slate-50 dark:bg-slate-800/40">
                      <td colSpan={canManage ? 6 : 5} className="px-4 py-2">
                        <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                          <Icon name={DEPT_ICON[g.key] ?? "layers"} className="h-4 w-4 text-brand-500" />
                          {g.label}
                          <span className="rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">{g.roles.length}</span>
                        </div>
                      </td>
                    </tr>
                    {g.roles.map((r) => {
                      no += 1;
                      return (
                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3 text-slate-400">{no}</td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-800 dark:text-slate-100">{r.name}</span>
                            {r.bossOnly && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{tr(locale, { uz: "Faqat boss", ru: "Только босс", en: "Boss only", de: "Nur Chef" })}</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{r.description || "—"}</td>
                          <td className="px-4 py-3 text-center"><span className="rounded-md bg-brand-500/15 px-2 py-0.5 text-xs font-bold text-brand-600 dark:text-brand-300">{r.permissions.length}</span></td>
                          <td className="px-4 py-3 text-center text-slate-500">{r.staff}</td>
                          {canManage && (
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2 text-slate-400">
                                <button onClick={() => { setEditing(r); setOpen(true); }} className="transition hover:text-brand-600" title={tr(locale, { uz: "Tahrirlash", ru: "Редактировать", en: "Edit", de: "Bearbeiten" })}><Icon name="pencil" className="h-4 w-4" /></button>
                                <button onClick={() => del(r.id)} className="transition hover:text-rose-600" title={tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete", de: "Löschen" })}><Icon name="trash" className="h-4 w-4" /></button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </Fragment>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {open && canManage && <RoleForm editing={editing} locale={locale} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); router.refresh(); }} />}
    </div>
  );
}

function RoleForm({ editing, onClose, onSaved, locale }: { editing: VRole | null; onClose: () => void; onSaved: () => void; locale: Locale }) {
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [sel, setSel] = useState<Set<string>>(new Set(editing?.permissions ?? []));
  const [bossOnly, setBossOnly] = useState(editing?.bossOnly ?? false);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  if (!mounted) return null;

  const allChecked = sel.size === ALL_PERM_KEYS.length;
  const toggle = (key: string) => setSel((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleAll = () => setSel(allChecked ? new Set() : new Set(ALL_PERM_KEYS));
  const toggleGroup = (keys: string[]) => setSel((p) => {
    const n = new Set(p); const allOn = keys.every((k) => n.has(k));
    keys.forEach((k) => (allOn ? n.delete(k) : n.add(k))); return n;
  });

  const submit = () => {
    setError(null);
    const fd = new FormData(formRef.current!);
    fd.set("permissions", [...sel].join(","));
    fd.set("bossOnly", bossOnly ? "true" : "false");
    start(async () => { const r = await saveRole(fd); if (r.ok) onSaved(); else setError(r.error ?? tr(locale, { uz: "Xatolik", ru: "Ошибка", en: "Error", de: "Fehler" })); });
  };

  const inp = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";
  const lbl = "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <form ref={formRef} onMouseDown={(e) => e.stopPropagation()} className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[760px] max-w-[96%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]">
        <input type="hidden" name="id" defaultValue={editing?.id ?? ""} />
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{editing ? tr(locale, { uz: "Rolni tahrirlash", ru: "Редактировать роль", en: "Edit role", de: "Rolle bearbeiten" }) : tr(locale, { uz: "Rol qo'shish", ru: "Добавить роль", en: "Add role", de: "Rolle hinzufügen" })}</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">✕</button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={lbl}>{tr(locale, { uz: "Ism", ru: "Имя", en: "Name", de: "Name" })} <span className="text-rose-500">*</span></label><input name="name" required defaultValue={editing?.name ?? ""} placeholder={tr(locale, { uz: "Rol nomi", ru: "Название роли", en: "Role name", de: "Rollenname" })} className={inp} /></div>
            <div>
              <label className={lbl}>{tr(locale, { uz: "Bo'lim", ru: "Отдел", en: "Department", de: "Abteilung" })}</label>
              <select name="department" defaultValue={editing?.department ?? ""} className={inp}>
                <option value="">{tr(locale, { uz: "Bo'limsiz", ru: "Без отдела", en: "No department", de: "Keine Abteilung" })}</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                {editing?.department && !DEPARTMENTS.includes(editing.department as never) && <option value={editing.department}>{editing.department}</option>}
              </select>
            </div>
            <div className="sm:col-span-2"><label className={lbl}>{tr(locale, { uz: "Izoh", ru: "Описание", en: "Description", de: "Beschreibung" })}</label><input name="description" defaultValue={editing?.description ?? ""} placeholder={tr(locale, { uz: "Izoh", ru: "Описание", en: "Description", de: "Beschreibung" })} className={inp} /></div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-slate-50 px-4 py-3 dark:bg-white/[0.03]">
            <Check checked={bossOnly} onChange={() => setBossOnly((v) => !v)} label={tr(locale, { uz: "Faqat boss ko'ra oladi", ru: "Видит только босс", en: "Only boss can view", de: "Nur der Chef kann es sehen" })} />
            <Check checked={allChecked} onChange={toggleAll} label={tr(locale, { uz: "Hammasi", ru: "Все", en: "All", de: "Alle" })} strong />
            <span className="ml-auto text-xs text-slate-400">{sel.size} / {ALL_PERM_KEYS.length} {tr(locale, { uz: "ruxsat", ru: "разрешений", en: "permissions", de: "Berechtigungen" })}</span>
          </div>

          {/* Ruxsatlar matritsasi */}
          <div className="space-y-3">
            {PERM_GROUPS.map((grp) => {
              const keys = grp.items.map((i) => i.key);
              const groupAll = keys.every((k) => sel.has(k));
              return (
                <div key={grp.group.uz}>
                  <button type="button" onClick={() => toggleGroup(keys)} className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-slate-500 hover:text-brand-600 dark:text-slate-300">
                    <span className={cn("grid h-4 w-4 place-items-center rounded border text-[10px]", groupAll ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 dark:border-slate-600")}>{groupAll ? "✓" : ""}</span>
                    {tr(locale, grp.group)}
                  </button>
                  <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {grp.items.map((it) => (
                      <label key={it.key} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition", sel.has(it.key) ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-200" : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/5")}>
                        <input type="checkbox" checked={sel.has(it.key)} onChange={() => toggle(it.key)} className="h-4 w-4 rounded border-slate-300 accent-brand-600" />
                        <span className="truncate">{tr(locale, it.label)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300">{tr(locale, { uz: "Orqaga", ru: "Назад", en: "Back", de: "Zurück" })}</button>
          <button type="button" onClick={submit} disabled={pending} className="flex-[1.4] rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{pending ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving...", de: "Wird gespeichert..." }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}</button>
        </div>
      </form>
    </div>, document.body);
}

function Check({ checked, onChange, label, strong }: { checked: boolean; onChange: () => void; label: string; strong?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2 text-sm", strong ? "font-semibold text-slate-700 dark:text-slate-200" : "text-slate-600 dark:text-slate-300")}>
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 rounded border-slate-300 accent-brand-600" />
      {label}
    </label>
  );
}
