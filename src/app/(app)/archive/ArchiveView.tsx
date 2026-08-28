"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { exportRows } from "@/lib/export";
import { Icon } from "../_components/Icon";
import { restoreUsers, deleteUsersPermanent, messageUsers, saveArchiveReasons } from "./actions";

export interface VArchived {
  id: string; fullName: string; phone: string | null; role: string; roleLabel: string;
  reason: string | null; note: string | null; archivedAt: string; archivedAtIso: string;
}
export interface RoleOpt { value: string; label: string }

export default function ArchiveView({ locale, rows, reasons, roleOptions, canPurge }: { locale: Locale; rows: VArchived[]; reasons: string[]; roleOptions: RoleOpt[]; canPurge: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [search, setSearch] = useState("");
  const [roleF, setRoleF] = useState("");
  const [reasonF, setReasonF] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  const pageSize = 20;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !`${r.fullName} ${r.phone ?? ""}`.toLowerCase().includes(q)) return false;
      if (roleF && r.role !== roleF) return false;
      if (reasonF && (r.reason ?? "") !== reasonF) return false;
      if (from && r.archivedAtIso < from) return false;
      if (to && r.archivedAtIso > to) return false;
      return true;
    });
  }, [rows, search, roleF, reasonF, from, to]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const shown = filtered.slice((curPage - 1) * pageSize, curPage * pageSize);

  const allShownSelected = shown.length > 0 && shown.every((r) => sel.has(r.id));
  const toggleAll = () => setSel((s) => { const n = new Set(s); if (allShownSelected) shown.forEach((r) => n.delete(r.id)); else shown.forEach((r) => n.add(r.id)); return n; });
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selIds = () => Array.from(sel);
  const need = () => { if (sel.size === 0) { flash(tr(locale, { uz: "Avval belgilang", ru: "Сначала выберите", en: "Select first" })); return false; } return true; };

  const onRestore = (ids: string[]) => start(async () => { const r = await restoreUsers(ids); if (r.ok) { setSel(new Set()); router.refresh(); flash(tr(locale, { uz: `${r.count} ta tiklandi`, ru: `Восстановлено: ${r.count}`, en: `${r.count} restored` })); } else flash(r.error ?? tr(locale, { uz: "Xatolik", ru: "Ошибка", en: "Error" })); });
  const onDelete = (ids: string[]) => { if (!confirm(tr(locale, { uz: `${ids.length} ta yozuvni butunlay o'chirasizmi? Bu qaytmas.`, ru: `Удалить ${ids.length} записей навсегда? Это необратимо.`, en: `Permanently delete ${ids.length} records? This cannot be undone.` }))) return; start(async () => { const r = await deleteUsersPermanent(ids); if (r.ok) { setSel(new Set()); router.refresh(); flash(tr(locale, { uz: `${r.count} o'chirildi${r.failed ? `, ${r.failed} o'chmadi (bog'liq ma'lumot)` : ""}`, ru: `Удалено: ${r.count}${r.failed ? `, не удалено: ${r.failed} (связанные данные)` : ""}`, en: `${r.count} deleted${r.failed ? `, ${r.failed} not deleted (linked data)` : ""}` })); } else flash(r.error ?? tr(locale, { uz: "Xatolik", ru: "Ошибка", en: "Error" })); }); };
  const onMessage = () => { if (!need()) return; const text = window.prompt(tr(locale, { uz: "Xabar matni:", ru: "Текст сообщения:", en: "Message text:" }), ""); if (text == null) return; start(async () => { const r = await messageUsers(selIds(), text); flash(r.ok ? tr(locale, { uz: `${r.count} ga yuborildi`, ru: `Отправлено: ${r.count}`, en: `Sent to ${r.count}` }) : r.error ?? tr(locale, { uz: "Xatolik", ru: "Ошибка", en: "Error" })); }); };

  const exportCsv = () => exportRows("arxiv", [
    { key: "fullName", label: tr(locale, { uz: "Ism", ru: "Имя", en: "Name" }) }, { key: "phone", label: tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone" }) }, { key: "roleLabel", label: tr(locale, { uz: "Roli", ru: "Роль", en: "Role" }) },
    { key: "reason", label: tr(locale, { uz: "Sabab", ru: "Причина", en: "Reason" }) }, { key: "note", label: tr(locale, { uz: "Izoh", ru: "Примечание", en: "Note" }) }, { key: "archivedAt", label: tr(locale, { uz: "Arxivlandi", ru: "Архивировано", en: "Archived" }) },
  ], filtered.map((r) => ({ ...r, phone: r.phone ?? "", reason: r.reason ?? "", note: r.note ?? "" })));

  const allReasons = Array.from(new Set([...reasons, ...rows.map((r) => r.reason).filter(Boolean) as string[]]));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[26px] font-bold tracking-tight text-slate-900 dark:text-slate-100">Arxiv</h1>
          <span className="text-sm text-slate-400">Miqdor — <b className="text-slate-600 dark:text-slate-300">{filtered.length}</b></span>
        </div>
        <button onClick={() => setReasonsOpen(true)} className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">Arxivlash sabablari</button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ism yoki Telefon" className={fInp} />
        </div>
        <select value={roleF} onChange={(e) => setRoleF(e.target.value)} className={cn(fInp, "min-w-[170px]")}>
          <option value="">Rollar bo&apos;yicha filtr</option>
          {roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={reasonF} onChange={(e) => setReasonF(e.target.value)} className={cn(fInp, "min-w-[170px]")}>
          <option value="">Sabab bo&apos;yicha filtr</option>
          {allReasons.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={cn(fInp, "w-[160px]")} title="Boshlanish sanasi" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={cn(fInp, "w-[160px]")} title="Tugash sanasi" />
        {/* Butunlay o'chirish — faqat direktor va o'rinbosarida */}
        {canPurge && <button onClick={() => need() && onDelete(selIds())} className="flex h-10 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:bg-slate-900 dark:hover:bg-rose-500/10"><Icon name="trash" className="h-4 w-4" /> O&apos;chirish</button>}
        <button onClick={() => need() && onRestore(selIds())} className="flex h-10 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-slate-900 dark:hover:bg-emerald-500/10"><Icon name="refresh" className="h-4 w-4" /> Qayta tiklash</button>
        <button onClick={onMessage} title="Belgilanganlarga xabar" className="grid h-10 w-11 place-items-center rounded-lg border border-slate-200 bg-white text-amber-500 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"><Icon name="mail" className="h-5 w-5" /></button>
      </div>

      {/* Jadval */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-slate-200/70 text-[13px] font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
              <tr>
                <th className="w-12 px-4 py-4"><input type="checkbox" checked={allShownSelected} onChange={toggleAll} className="h-4 w-4 rounded accent-brand-600" /></th>
                <th className="px-4 py-4">Ism</th>
                <th className="px-4 py-4">Telefon</th>
                <th className="px-4 py-4">Roli</th>
                <th className="px-4 py-4">Ochirib tashlash sababi</th>
                <th className="px-4 py-4">Izoh</th>
                <th className="px-4 py-4">Arxivlandi</th>
                <th className="px-4 py-4 text-right">Harakatlar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {shown.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center text-slate-400">Bo&apos;sh</td></tr>
              ) : shown.map((r) => (
                <tr key={r.id} className={cn("transition hover:bg-slate-50 dark:hover:bg-slate-800/40", sel.has(r.id) && "bg-brand-50/50 dark:bg-brand-500/10")}>
                  <td className="px-4 py-3"><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 rounded accent-brand-600" /></td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{r.fullName}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">{r.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.roleLabel}</td>
                  <td className="px-4 py-3 text-slate-500">{r.reason ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{r.note ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-500">{r.archivedAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => onRestore([r.id])} title="Qayta tiklash" className="grid h-8 w-8 place-items-center rounded-lg text-emerald-500 transition hover:bg-emerald-50 dark:hover:bg-emerald-500/10"><Icon name="refresh" className="h-4 w-4" /></button>
                      {canPurge && <button onClick={() => onDelete([r.id])} title="Butunlay o'chirish" className="grid h-8 w-8 place-items-center rounded-lg text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-500/10"><Icon name="trash" className="h-4 w-4" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pastki qism: pagination + eksport */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <PageBtn disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}>‹</PageBtn>
          <span className="grid h-8 min-w-8 place-items-center rounded-lg bg-brand-600 px-2 text-sm font-semibold text-white">{curPage}</span>
          <PageBtn disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)}>›</PageBtn>
        </div>
        <button onClick={exportCsv} title="Eksport (CSV)" className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><Icon name="download" className="h-4 w-4" /></button>
      </div>

      {reasonsOpen && <ReasonsModal reasons={reasons} onClose={() => setReasonsOpen(false)} onSaved={() => { setReasonsOpen(false); router.refresh(); flash("Sabablar saqlandi"); }} />}
      {toast && <div className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-pop dark:bg-slate-700">{toast}</div>}
    </div>
  );
}

const fInp = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

function PageBtn({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return <button onClick={onClick} disabled={disabled} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800">{children}</button>;
}

function ReasonsModal({ reasons, onClose, onSaved }: { reasons: string[]; onClose: () => void; onSaved: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [list, setList] = useState<string[]>(reasons);
  const [val, setVal] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  if (!mounted) return null;

  const add = () => { const v = val.trim(); if (v && !list.includes(v)) setList((l) => [...l, v]); setVal(""); };
  const save = () => start(async () => { await saveArchiveReasons(list); onSaved(); });

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-pop dark:border-slate-800 dark:bg-slate-900" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Arxivlash sabablari</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><Icon name="close" className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className="flex gap-2">
            <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Yangi sabab..." className={fInp} />
            <button onClick={add} className="h-10 shrink-0 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">Qo&apos;shish</button>
          </div>
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {list.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Sabab yo&apos;q</p> : list.map((r) => (
              <div key={r} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-white/[0.03]">
                <span className="text-slate-700 dark:text-slate-200">{r}</span>
                <button onClick={() => setList((l) => l.filter((x) => x !== r))} className="text-slate-400 hover:text-rose-500"><Icon name="close" className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Bekor</button>
          <button onClick={save} disabled={pending} className="flex-[1.4] rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "Saqlanmoqda..." : "Saqlash"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
