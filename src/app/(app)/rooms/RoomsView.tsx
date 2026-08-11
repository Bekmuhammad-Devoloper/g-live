"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";
import { saveRoom, deleteRoom } from "./actions";

export interface RoomStatus { busy: boolean; group: string | null; course: string | null; until: string | null; freeMin: number | null }
export interface VRoom { id: string; name: string; capacity: number; note: string | null; status: RoomStatus }

export default function RoomsView({ locale, rooms, canManage }: { locale: Locale; rooms: VRoom[]; canManage: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<null | { edit: VRoom | null }>(null);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2000); };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rooms.filter((r) => `${r.name} ${r.note ?? ""}`.toLowerCase().includes(q)) : rooms;
  }, [rooms, search]);

  const onDelete = (r: VRoom) => { if (confirm(tr(locale, { uz: `"${r.name}" xonasini o'chirasizmi?`, ru: `Удалить кабинет "${r.name}"?`, en: `Delete room "${r.name}"?` }))) start(async () => { await deleteRoom(r.id); router.refresh(); flash(tr(locale, { uz: "O'chirildi", ru: "Удалено", en: "Deleted" })); }); };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[26px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Xonalar", ru: "Кабинеты", en: "Rooms" })}</h1>
        {canManage && (
          <button onClick={() => setDrawer({ edit: null })} className="flex h-11 items-center gap-2 rounded-full bg-brand-800 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-900">
            {tr(locale, { uz: "Yangisini qo'shish", ru: "Добавить новый", en: "Add new" })}
          </button>
        )}
      </div>

      {rooms.length > 6 && (
        <div className="relative max-w-xs">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr(locale, { uz: "Xona qidirish...", ru: "Поиск кабинета...", en: "Search room..." })} className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
        </div>
      )}

      {/* Jadval */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
              <tr>
                <th className="w-14 px-6 py-3.5">№</th>
                <th className="px-6 py-3.5">{tr(locale, { uz: "Xona nomi", ru: "Название", en: "Room name" })}</th>
                <th className="px-6 py-3.5">{tr(locale, { uz: "Sig'imi", ru: "Вместимость", en: "Capacity" })}</th>
                <th className="px-6 py-3.5">{tr(locale, { uz: "Izoh", ru: "Примечание", en: "Note" })}</th>
                <th className="px-6 py-3.5 text-right">{tr(locale, { uz: "Amallar", ru: "Действия", en: "Actions" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {shown.length === 0 ? (
                <tr><td colSpan={5} className="py-16 text-center text-slate-400">{tr(locale, { uz: "Xona topilmadi", ru: "Кабинет не найден", en: "No rooms found" })}</td></tr>
              ) : shown.map((r, i) => (
                <tr key={r.id} className="group transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-6 py-4"><span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{i + 1}</span></td>
                  <td className="px-6 py-4">
                    <Link href={`/rooms/${r.id}`} className="flex items-center gap-3 transition hover:text-brand-600">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-600 dark:text-brand-300"><Icon name="building" className="h-5 w-5" /></span>
                      <span className="font-semibold text-slate-800 group-hover:text-brand-600 dark:text-slate-100 dark:group-hover:text-brand-300">{r.name}</span>
                    </Link>
                  </td>
                  <td className="px-6 py-4">{r.capacity > 0 ? <span className="inline-flex items-center gap-1 rounded-md bg-brand-500/15 px-2 py-0.5 text-xs font-bold text-brand-600 dark:text-brand-300"><Icon name="users" className="h-3.5 w-3.5" /> {r.capacity}</span> : <span className="text-slate-400">—</span>}</td>
                  <td className="max-w-xs px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{r.note && r.note.trim() ? r.note : <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2.5">
                      <StatusPill status={r.status} locale={locale} />
                      <Link href={`/rooms/${r.id}`} title={tr(locale, { uz: "Xona ma'lumotlari", ru: "Информация о кабинете", en: "Room details" })} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"><Icon name="building" className="h-4 w-4" /></Link>
                      {canManage && (
                        <>
                          <button onClick={() => setDrawer({ edit: r })} title={tr(locale, { uz: "Tahrirlash", ru: "Редактировать", en: "Edit" })} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"><Icon name="pencil" className="h-4 w-4" /></button>
                          <button onClick={() => onDelete(r)} title={tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete" })} className="grid h-8 w-8 place-items-center rounded-lg text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-500/10"><Icon name="trash" className="h-4 w-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {drawer && <RoomDrawer locale={locale} edit={drawer.edit} onClose={() => setDrawer(null)} onSaved={(m) => { setDrawer(null); router.refresh(); flash(m); }} />}
      {toast && <div className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-pop dark:bg-slate-700">{toast}</div>}
    </div>
  );
}

const inp = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";

function durStr(m: number, locale: Locale): string {
  const h = Math.floor(m / 60), mm = m % 60;
  const soat = tr(locale, { uz: "soat", ru: "ч", en: "h" });
  const daq = tr(locale, { uz: "daq", ru: "мин", en: "m" });
  if (h > 0) return `${h} ${soat}${mm ? ` ${mm} ${daq}` : ""}`;
  return `${mm} ${daq}`;
}

// Hozirgi holat: band bo'lsa qaysi guruh, bo'sh bo'lsa qancha vaqt bo'sh
function StatusPill({ status, locale }: { status: RoomStatus; locale: Locale }) {
  if (status.busy) {
    return (
      <span
        title={`${status.course ?? ""}${status.until ? ` · ${tr(locale, { uz: `${status.until} gacha`, ru: `до ${status.until}`, en: `until ${status.until}` })}` : ""}`}
        className="inline-flex max-w-[200px] items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
      >
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500" />
        <span className="truncate">{status.group}</span>
        {status.until && <span className="shrink-0 opacity-70">· {status.until}</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
      {tr(locale, { uz: "Bo'sh", ru: "Свободно", en: "Free" })}
      {status.until ? (
        <span className="opacity-80">· {tr(locale, { uz: `${status.until} gacha`, ru: `до ${status.until}`, en: `until ${status.until}` })}{status.freeMin != null ? ` · ${durStr(status.freeMin, locale)}` : ""}</span>
      ) : (
        <span className="opacity-70">· {tr(locale, { uz: "kun oxirigacha bo'sh", ru: "свободно до конца дня", en: "free until end of day" })}</span>
      )}
    </span>
  );
}

function RoomDrawer({ locale, edit, onClose, onSaved }: { locale: Locale; edit: VRoom | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const [mounted, setMounted] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
      const r = await saveRoom(fd);
      if (r.ok) onSaved(edit ? tr(locale, { uz: "Saqlandi", ru: "Сохранено", en: "Saved" }) : tr(locale, { uz: "Xona qo'shildi", ru: "Кабинет добавлен", en: "Room added" }));
      else setError(r.error ?? tr(locale, { uz: "Xatolik", ru: "Ошибка", en: "Error" }));
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <form onSubmit={submit} onMouseDown={(e) => e.stopPropagation()} className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[380px] max-w-[88%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]">
        {edit && <input type="hidden" name="id" defaultValue={edit.id} />}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{edit ? tr(locale, { uz: "Xonani tahrirlash", ru: "Редактировать кабинет", en: "Edit room" }) : tr(locale, { uz: "Yangi xona qo'shish", ru: "Добавить новый кабинет", en: "Add new room" })}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><Icon name="close" className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">{tr(locale, { uz: "Ism", ru: "Название", en: "Name" })}</span>
            <input name="name" required defaultValue={edit?.name ?? ""} placeholder={tr(locale, { uz: "Masalan: Room #1", ru: "Например: Room #1", en: "e.g. Room #1" })} className={inp} autoFocus />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">{tr(locale, { uz: "Xona sig'imi", ru: "Вместимость", en: "Capacity" })}</span>
            <input name="capacity" type="number" min={0} max={1000} defaultValue={edit?.capacity ?? ""} placeholder="0" className={inp} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">{tr(locale, { uz: "Izoh", ru: "Примечание", en: "Note" })} <span className="text-slate-400">({tr(locale, { uz: "ixtiyoriy", ru: "необязательно", en: "optional" })})</span></span>
            <input name="note" defaultValue={edit?.note ?? ""} placeholder={tr(locale, { uz: "Qo'shimcha ma'lumot", ru: "Дополнительная информация", en: "Additional info" })} className={inp} />
          </label>
          {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</div>}
        </div>
        <div className="shrink-0 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <button type="submit" disabled={pending} className="h-11 rounded-full bg-brand-800 px-8 text-sm font-semibold text-white transition hover:bg-brand-900 disabled:opacity-60">{pending ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving..." }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save" })}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
