"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { createStaff, updateStaff, deleteStaff, inviteStaff, importStaff } from "./actions";

export interface VStaff { id: string; shortId: string; fullName: string; role: string; roleLabel: string; position: string | null; phone: string | null }
export interface RoleOption { value: string; label: string }

export default function StaffView({ locale, rows, roleOptions, currentUserId, canDelete }: { locale: Locale; rows: VStaff[]; roleOptions: RoleOption[]; currentUserId: string; canDelete: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<null | { edit: VStaff | null }>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2000); };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.fullName} ${r.roleLabel} ${r.position ?? ""} ${r.phone ?? ""}`.toLowerCase().includes(q));
  }, [rows, search]);

  const onInvite = (id: string) => start(async () => { const r = await inviteStaff(id); flash(r.ok ? tr(locale, { uz: "Taklif yuborildi", ru: "Приглашение отправлено", en: "Invitation sent" }) : r.error ?? tr(locale, { uz: "Xatolik", ru: "Ошибка", en: "Error" })); });
  const onDelete = (r: VStaff) => { if (r.id === currentUserId) { flash(tr(locale, { uz: "O'zingizni o'chira olmaysiz", ru: "Вы не можете удалить себя", en: "You cannot delete yourself" })); return; } if (confirm(tr(locale, { uz: `${r.fullName} ni ro'yxatdan olib tashlaysizmi?`, ru: `Удалить ${r.fullName} из списка?`, en: `Remove ${r.fullName} from the list?` }))) start(async () => { await deleteStaff(r.id); router.refresh(); }); };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[26px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Xodimlar", ru: "Сотрудники", en: "Staff" })}</h1>
        <div className="flex items-center gap-2.5">
          <button onClick={() => setDrawer({ edit: null })} className="flex h-11 items-center gap-2 rounded-full bg-brand-800 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-900">
            {tr(locale, { uz: "Yangisini qo'shish", ru: "Добавить нового", en: "Add new" })}
          </button>
          <button onClick={() => setImportOpen(true)} className="flex h-11 items-center gap-2 rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
            <Icon name="download" className="h-4 w-4" /> {tr(locale, { uz: "Import", ru: "Импорт", en: "Import" })}
          </button>
        </div>
      </div>

      {/* Search */}
      {rows.length > 6 && (
        <div className="relative max-w-xs">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr(locale, { uz: "Xodim qidirish...", ru: "Поиск сотрудника...", en: "Search staff..." })} className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-200/70 text-[13px] font-semibold text-slate-500 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">{tr(locale, { uz: "id", ru: "id", en: "id" })}</th>
                <th className="px-6 py-4">{tr(locale, { uz: "Ism", ru: "Имя", en: "Name" })}</th>
                <th className="px-6 py-4">{tr(locale, { uz: "Roli", ru: "Роль", en: "Role" })}</th>
                <th className="px-6 py-4">{tr(locale, { uz: "Lavozimi", ru: "Должность", en: "Position" })}</th>
                <th className="px-6 py-4">{tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone" })}</th>
                <th className="px-6 py-4 text-right">{tr(locale, { uz: "Amallar", ru: "Действия", en: "Actions" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {shown.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-slate-400">{tr(locale, { uz: "Xodim topilmadi", ru: "Сотрудник не найден", en: "No staff found" })}</td></tr>
              ) : shown.map((r) => (
                <tr key={r.id} className="group transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-6 py-4 font-mono text-xs text-brand-600 dark:text-brand-400">{r.shortId}</td>
                  <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-100">{r.fullName}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{r.roleLabel}</td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{r.position ?? "—"}</td>
                  <td className="px-6 py-4 tabular-nums text-slate-600 dark:text-slate-300">{r.phone ?? "—"}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => onInvite(r.id)} title={tr(locale, { uz: "Taklif / xabar yuborish", ru: "Отправить приглашение / сообщение", en: "Send invite / message" })} className="grid h-8 w-8 place-items-center rounded-lg text-amber-500 transition hover:bg-amber-50 dark:hover:bg-amber-500/10"><Icon name="mail" className="h-5 w-5" /></button>
                      <button onClick={() => setDrawer({ edit: r })} title={tr(locale, { uz: "Tahrirlash", ru: "Редактировать", en: "Edit" })} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-brand-600 group-hover:opacity-100 dark:hover:bg-slate-800"><Icon name="pencil" className="h-4 w-4" /></button>
                      {/* O'chirish — faqat direktor va o'rinbosarida */}
                      {canDelete && <button onClick={() => onDelete(r)} title={tr(locale, { uz: "Olib tashlash", ru: "Удалить", en: "Remove" })} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-rose-500/10"><Icon name="trash" className="h-4 w-4" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {drawer && <StaffDrawer locale={locale} edit={drawer.edit} roleOptions={roleOptions} onClose={() => setDrawer(null)} onSaved={(m) => { setDrawer(null); router.refresh(); flash(m); }} />}
      {importOpen && <ImportModal locale={locale} onClose={() => setImportOpen(false)} onDone={(m) => { setImportOpen(false); router.refresh(); flash(m); }} />}
      {toast && <div className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-pop dark:bg-slate-700">{toast}</div>}
    </div>
  );
}

const inp = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";

function StaffDrawer({ locale, edit, roleOptions, onClose, onSaved }: { locale: Locale; edit: VStaff | null; roleOptions: RoleOption[]; onClose: () => void; onSaved: (msg: string) => void }) {
  const [mounted, setMounted] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  if (!mounted) return null;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = edit ? await updateStaff(fd) : await createStaff(fd);
      if (r.ok) onSaved(edit ? tr(locale, { uz: "Saqlandi", ru: "Сохранено", en: "Saved" }) : tr(locale, { uz: "Xodim qo'shildi", ru: "Сотрудник добавлен", en: "Staff member added" }));
      else setError(r.error ?? tr(locale, { uz: "Xatolik", ru: "Ошибка", en: "Error" }));
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <form ref={formRef} onSubmit={submit} onMouseDown={(e) => e.stopPropagation()} className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[380px] max-w-[88%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]">
        {edit && <input type="hidden" name="id" defaultValue={edit.id} />}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{edit ? tr(locale, { uz: "Xodimni tahrirlash", ru: "Редактировать сотрудника", en: "Edit staff member" }) : tr(locale, { uz: "Yangi xodim qo'shish", ru: "Добавить нового сотрудника", en: "Add new staff member" })}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><Icon name="close" className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          <Field label={tr(locale, { uz: "F.I.Sh.", ru: "Ф.И.О.", en: "Full name" })} req><input name="fullName" required defaultValue={edit?.fullName ?? ""} placeholder={tr(locale, { uz: "Ism Familiya", ru: "Имя Фамилия", en: "First Last" })} className={inp} autoFocus /></Field>
          {!edit && <Field label={tr(locale, { uz: "Email (login)", ru: "Email (логин)", en: "Email (login)" })} req><input name="email" type="email" required placeholder="xodim@gl.uz" className={inp} /></Field>}
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr(locale, { uz: "Rol", ru: "Роль", en: "Role" })} req>
              <select name="role" required defaultValue={edit?.role ?? ""} className={inp}>
                <option value="" disabled>{tr(locale, { uz: "— tanlang —", ru: "— выберите —", en: "— select —" })}</option>
                {roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label={tr(locale, { uz: "Lavozimi", ru: "Должность", en: "Position" })}><input name="position" defaultValue={edit?.position ?? ""} placeholder={tr(locale, { uz: "Masalan: CEO", ru: "Например: CEO", en: "e.g. CEO" })} className={inp} /></Field>
          </div>
          <Field label={tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone" })}><input name="phone" defaultValue={edit?.phone ?? ""} placeholder="+998 90 123 45 67" className={inp} /></Field>
          <Field label={edit ? tr(locale, { uz: "Yangi parol (ixtiyoriy)", ru: "Новый пароль (необязательно)", en: "New password (optional)" }) : tr(locale, { uz: "Parol", ru: "Пароль", en: "Password" })} req={!edit}><input name="password" type="text" required={!edit} placeholder={edit ? tr(locale, { uz: "O'zgartirish uchun kiriting", ru: "Введите, чтобы изменить", en: "Enter to change" }) : tr(locale, { uz: "Kamida 4 ta belgi", ru: "Минимум 4 символа", en: "At least 4 characters" })} className={inp} /></Field>
          {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</div>}
        </div>
        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">{tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel" })}</button>
          <button type="submit" disabled={pending} className="flex-[1.4] rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{pending ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving..." }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save" })}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function parseCsv(text: string): { fullName: string; email: string; phone?: string; position?: string; role?: string; password?: string }[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const split = (l: string) => l.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
  const known = ["fullname", "email", "phone", "position", "role", "password"];
  const first = split(lines[0]).map((h) => h.toLowerCase());
  const hasHeader = first.some((h) => known.includes(h));
  const cols = hasHeader ? first : ["fullname", "email", "phone", "position", "role", "password"];
  const body = hasHeader ? lines.slice(1) : lines;
  return body.map((l) => {
    const parts = split(l);
    const o: Record<string, string> = {};
    cols.forEach((c, i) => { o[c] = parts[i] ?? ""; });
    return { fullName: o.fullname || o.ism || "", email: o.email || "", phone: o.phone, position: o.position || o.lavozim, role: o.role, password: o.password };
  });
}

function ImportModal({ locale, onClose, onDone }: { locale: Locale; onClose: () => void; onDone: (msg: string) => void }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onFile = (f: File | undefined) => { if (!f) return; f.text().then((t) => setText(t)); };
  const run = () => {
    setError(null);
    const rows = parseCsv(text).filter((r) => r.fullName || r.email);
    if (rows.length === 0) { setError(tr(locale, { uz: "Ma'lumot topilmadi. CSV: fullName,email,phone,position,role,password", ru: "Данные не найдены. CSV: fullName,email,phone,position,role,password", en: "No data found. CSV: fullName,email,phone,position,role,password" })); return; }
    start(async () => {
      const res = await importStaff(rows);
      onDone(tr(locale, {
        uz: `${res.created} ta qo'shildi${res.skipped ? `, ${res.skipped} o'tkazildi` : ""}`,
        ru: `Добавлено: ${res.created}${res.skipped ? `, пропущено: ${res.skipped}` : ""}`,
        en: `${res.created} added${res.skipped ? `, ${res.skipped} skipped` : ""}`,
      }));
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-pop dark:border-slate-800 dark:bg-slate-900" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Xodimlarni import qilish", ru: "Импорт сотрудников", en: "Import staff" })}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><Icon name="close" className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">{tr(locale, { uz: "CSV ustunlari:", ru: "Столбцы CSV:", en: "CSV columns:" })} <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">fullName, email, phone, position, role, password</code>. {tr(locale, { uz: "Rol: MANAGER/TEACHER/ADMIN/DIRECTOR/DEPUTY_DIRECTOR. Parol bo'lmasa", ru: "Роль: MANAGER/TEACHER/ADMIN/DIRECTOR/DEPUTY_DIRECTOR. Если пароль не указан,", en: "Role: MANAGER/TEACHER/ADMIN/DIRECTOR/DEPUTY_DIRECTOR. If no password is given," })} <b>12345678</b> {tr(locale, { uz: "beriladi.", ru: "назначается.", en: "is assigned." })}</p>
          <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 text-sm font-medium text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            <Icon name="download" className="h-4 w-4" /> {tr(locale, { uz: "CSV fayl tanlash", ru: "Выбрать CSV-файл", en: "Choose CSV file" })}
            <input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <div className="text-center text-[11px] text-slate-400">{tr(locale, { uz: "yoki jadvalni shu yerga joylang", ru: "или вставьте таблицу сюда", en: "or paste the table here" })}</div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={tr(locale, { uz: "Ism Familiya,email@gl.uz,+99890...,CEO,DIRECTOR,parol", ru: "Имя Фамилия,email@gl.uz,+99890...,CEO,DIRECTOR,пароль", en: "First Last,email@gl.uz,+99890...,CEO,DIRECTOR,password" })} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100" />
          {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</div>}
        </div>
        <div className="flex gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel" })}</button>
          <button onClick={run} disabled={pending} className="flex-[1.4] rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{pending ? tr(locale, { uz: "Import qilinmoqda...", ru: "Импорт...", en: "Importing..." }) : tr(locale, { uz: "Import qilish", ru: "Импортировать", en: "Import" })}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">{label}{req && <span className="text-rose-500"> *</span>}</span>
      {children}
    </label>
  );
}
