"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "./Icon";

export interface CrudField {
  name: string; label: string; type?: "text" | "textarea" | "number"; required?: boolean; placeholder?: string;
}
export interface CrudColumn {
  key: string; label: string; align?: "right" | "center"; render?: (row: Record<string, unknown>) => React.ReactNode;
}
export type SaveResult = { ok?: boolean; error?: string };

export default function CrudTable({ title, addLabel, rows, columns, fields, canManage, saveAction, deleteAction, searchable = true, locale = "uz" }: {
  title: string; addLabel: string; rows: Record<string, unknown>[]; columns: CrudColumn[]; fields: CrudField[]; canManage: boolean;
  saveAction: (fd: FormData) => Promise<SaveResult>; deleteAction: (id: string) => Promise<void>; searchable?: boolean; locale?: Locale;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [rows, search]);

  const openCreate = () => { setEditing(null); setOpen(true); };
  const openEdit = (row: Record<string, unknown>) => { setEditing(row); setOpen(true); };
  const del = (id: string) => { if (confirm(tr(locale, { uz: "O'chirishni tasdiqlaysizmi?", ru: "Подтвердите удаление?", en: "Confirm deletion?" }))) start(async () => { await deleteAction(id); router.refresh(); }); };

  return (
    <div className="space-y-4">
      <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>

      <div className="flex flex-wrap items-center gap-2">
        {canManage && (
          <button onClick={openCreate} className="flex h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
            <Icon name="plus" className="h-4 w-4" /> {addLabel}
          </button>
        )}
        {searchable && (
          <div className="relative ml-auto">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr(locale, { uz: "Qidiruv", ru: "Поиск", en: "Search" })} className="h-10 w-60 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          </div>
        )}
      </div>

      <div className={cn("overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900", pending && "opacity-70")}>
        <div className="flex items-center justify-end border-b border-slate-100 px-4 py-2 dark:border-slate-800">
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{tr(locale, { uz: "Umumiy soni", ru: "Всего", en: "Total" })}: {filtered.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="w-12 px-4 py-3">№</th>
                {columns.map((c) => <th key={c.key} className={cn("px-4 py-3", c.align === "right" && "text-right", c.align === "center" && "text-center")}>{c.label}</th>)}
                {canManage && <th className="px-4 py-3 text-right">{tr(locale, { uz: "Amallar", ru: "Действия", en: "Actions" })}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr><td colSpan={columns.length + 2} className="px-4 py-16 text-center">
                  <div className="text-3xl opacity-30">📭</div>
                  <p className="mt-2 font-medium text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi", ru: "Данные не найдены", en: "No data found" })}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{tr(locale, { uz: "Filterni o'zgartirib ko'ring.", ru: "Попробуйте изменить фильтр.", en: "Try changing the filter." })}</p>
                </td></tr>
              ) : filtered.map((row, i) => (
                <tr key={String(row.id)} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3 text-slate-700 dark:text-slate-200", c.align === "right" && "text-right", c.align === "center" && "text-center")}>
                      {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                    </td>
                  ))}
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2 text-slate-400">
                        <button onClick={() => openEdit(row)} className="transition hover:text-brand-600" title={tr(locale, { uz: "Tahrirlash", ru: "Редактировать", en: "Edit" })}><Icon name="pencil" className="h-4 w-4" /></button>
                        <button onClick={() => del(String(row.id))} className="transition hover:text-rose-600" title={tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete" })}><Icon name="trash" className="h-4 w-4" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && canManage && (
        <FormDrawer title={editing ? tr(locale, { uz: "Tahrirlash", ru: "Редактирование", en: "Edit" }) : addLabel} fields={fields} editing={editing} locale={locale} saveAction={saveAction} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); router.refresh(); }} />
      )}
    </div>
  );
}

function FormDrawer({ title, fields, editing, saveAction, onClose, onSaved, locale = "uz" }: {
  title: string; fields: CrudField[]; editing: Record<string, unknown> | null; saveAction: (fd: FormData) => Promise<SaveResult>; onClose: () => void; onSaved: () => void; locale?: Locale;
}) {
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  if (!mounted) return null;

  const submit = () => {
    setError(null);
    const fd = new FormData(formRef.current!);
    start(async () => { const res = await saveAction(fd); if (res.ok) onSaved(); else setError(res.error ?? tr(locale, { uz: "Xatolik", ru: "Ошибка", en: "Error" })); });
  };
  const inp = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <form ref={formRef} onMouseDown={(e) => e.stopPropagation()} className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[420px] max-w-[92%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]">
        <input type="hidden" name="id" defaultValue={editing ? String(editing.id) : ""} />
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">✕</button>
        </div>
        <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          {fields.map((f) => (
            <label key={f.name} className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{f.label}{f.required && <span className="text-rose-500"> *</span>}</span>
              {f.type === "textarea" ? (
                <textarea name={f.name} required={f.required} placeholder={f.placeholder} defaultValue={editing ? String(editing[f.name] ?? "") : ""} rows={3} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100" />
              ) : (
                <input name={f.name} type={f.type ?? "text"} required={f.required} placeholder={f.placeholder} defaultValue={editing ? String(editing[f.name] ?? "") : ""} className={inp} />
              )}
            </label>
          ))}
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}
        </div>
        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300">{tr(locale, { uz: "Bekor", ru: "Отмена", en: "Cancel" })}</button>
          <button type="button" onClick={submit} disabled={pending} className="flex-[1.4] rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{pending ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving..." }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save" })}</button>
        </div>
      </form>
    </div>, document.body);
}
