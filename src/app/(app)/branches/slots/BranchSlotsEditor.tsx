"use client";

import { useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { addBranchSlot, listBranchRooms, removeBranchSlot, type VSlot } from "./actions";

/**
 * Filialdagi bo'sh xona / bo'sh vaqtlar ro'yxati va qo'shish formasi.
 * Ikki joyda ishlatiladi: administrator dashboardi (o'z filiali) va ROP/rahbariyat
 * kanbanidagi filial ustuni (oyna). `canEdit=false` bo'lsa faqat ro'yxat.
 */
const DAYS: { key: string; label: { uz: string; ru: string; en: string; de: string } }[] = [
  { key: "Du", label: { uz: "Du", ru: "Пн", en: "Mo", de: "Mo" } },
  { key: "Se", label: { uz: "Se", ru: "Вт", en: "Tu", de: "Di" } },
  { key: "Chor", label: { uz: "Chor", ru: "Ср", en: "We", de: "Mi" } },
  { key: "Pay", label: { uz: "Pay", ru: "Чт", en: "Th", de: "Do" } },
  { key: "Ju", label: { uz: "Ju", ru: "Пт", en: "Fr", de: "Fr" } },
  { key: "Sha", label: { uz: "Sha", ru: "Сб", en: "Sa", de: "Sa" } },
  { key: "Yak", label: { uz: "Yak", ru: "Вс", en: "Su", de: "So" } },
];

export default function BranchSlotsEditor({ branchId, initial, canEdit, locale, compact = false, cards = false, color = "#10b981", onChanged }: {
  branchId: string;
  initial: VSlot[];
  canEdit: boolean;
  locale: Locale;
  /** Kanban ustuni ichida — kichik shrift, ixcham qatorlar */
  compact?: boolean;
  /** Har slot alohida karta (Kanbandagi guruh kartalari kabi) */
  cards?: boolean;
  /** Karta belgisi rangi (ustun rangi) */
  color?: string;
  onChanged?: (slots: VSlot[]) => void;
}) {
  const [slots, setSlots] = useState<VSlot[]>(initial);
  const [adding, setAdding] = useState(false);
  const [rooms, setRooms] = useState<string[]>([]);
  const [room, setRoom] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("19:30");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });

  useEffect(() => { setSlots(initial); }, [initial]);
  // Xonalar ro'yxati — forma ochilganda bir marta
  useEffect(() => { if (adding && rooms.length === 0) listBranchRooms(branchId).then(setRooms); }, [adding, branchId, rooms.length]);

  const apply = (r: { ok?: boolean; error?: string; slots?: VSlot[] }) => {
    if (r.error) {
      setErr(r.error === "room" ? L("Xonani kiriting", "Укажите аудиторию", "Enter the room", "Raum angeben")
        : r.error === "days" ? L("Kunlarni tanlang", "Выберите дни", "Select days", "Tage wählen")
        : r.error === "time" ? L("Vaqt noto'g'ri (boshlanish < tugash)", "Неверное время (начало < конец)", "Invalid time (start < end)", "Ungültige Zeit (Start < Ende)")
        : r.error === "forbidden" ? L("Ruxsat yo'q", "Нет доступа", "No permission", "Keine Berechtigung")
        : L("Saqlanmadi", "Не сохранено", "Not saved", "Nicht gespeichert"));
      return;
    }
    if (r.slots) { setSlots(r.slots); onChanged?.(r.slots); }
  };

  const add = () => run(async () => {
    setErr(null);
    const r = await addBranchSlot({ branchId, room, days: days.join(", "), startTime: start, endTime: end, note });
    apply(r);
    if (r.ok) { setAdding(false); setRoom(""); setDays([]); setNote(""); }
  });
  const remove = (id: string) => run(async () => apply(await removeBranchSlot(id)));
  const toggleDay = (k: string) => setDays((d) => (d.includes(k) ? d.filter((x) => x !== k) : DAYS.filter((x) => d.includes(x.key) || x.key === k).map((x) => x.key)));

  const inp = cn("w-full rounded-lg border border-slate-200 bg-white text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100", compact ? "h-8 px-2 text-xs" : "h-9 px-2.5 text-sm");

  return (
    <div>
      {slots.length === 0 && !adding && (
        <p className={cn("rounded-lg border border-dashed border-slate-200 px-3 text-center text-slate-400 dark:border-white/10", compact ? "py-2 text-[11px]" : "py-4 text-sm")}>
          {L("Bo'sh vaqt kiritilmagan", "Свободное время не указано", "No free slots yet", "Keine freien Zeiten eingetragen")}
        </p>
      )}

      {slots.length > 0 && cards && (
        // Alohida kartalar — Kanbandagi guruh kartalari bilan bir xil ko'rinish
        <ul className="space-y-3">
          {slots.map((sl) => (
            <li key={sl.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-white/[0.07] dark:bg-[#15243d]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ color, background: `${color}1f` }}>
                <Icon name="clock" className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{sl.room}</div>
                <div className="mt-0.5 text-[11px] text-slate-400">{sl.days} · <span className="tabular-nums">{sl.startTime}–{sl.endTime}</span></div>
                {sl.note && <div className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ color, background: `${color}14` }}>{sl.note}</div>}
              </div>
              {canEdit && (
                <button type="button" onClick={() => remove(sl.id)} disabled={pending} title={L("O'chirish", "Удалить", "Remove", "Entfernen")} className="shrink-0 text-slate-300 transition hover:text-rose-500">
                  <Icon name="close" className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {slots.length > 0 && !cards && (
        <ul className={cn("space-y-1", compact ? "" : "space-y-1.5")}>
          {slots.map((sl) => (
            <li key={sl.id} className={cn("flex items-start gap-2 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200", compact ? "px-2 py-1.5 text-[11px]" : "px-3 py-2 text-sm")}>
              <Icon name="clock" className={cn("mt-0.5 shrink-0", compact ? "h-3 w-3" : "h-4 w-4")} />
              <span className="min-w-0 flex-1 leading-snug">
                <span className="font-semibold">{sl.room}</span> · {sl.days} · <span className="tabular-nums">{sl.startTime}–{sl.endTime}</span>
                {sl.note && <span className="block text-emerald-700/80 dark:text-emerald-300/80">{sl.note}</span>}
              </span>
              {canEdit && (
                <button type="button" onClick={() => remove(sl.id)} disabled={pending} title={L("O'chirish", "Удалить", "Remove", "Entfernen")} className="shrink-0 text-emerald-600/60 transition hover:text-rose-600">
                  <Icon name="close" className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && !adding && (
        <button type="button" onClick={() => setAdding(true)} className={cn("mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-emerald-300 font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-500/10", compact ? "py-1.5 text-[11px]" : "py-2 text-xs")}>
          <Icon name="plus" className="h-3.5 w-3.5" /> {L("Bo'sh vaqt qo'shish", "Добавить свободное время", "Add free slot", "Freie Zeit hinzufügen")}
        </button>
      )}

      {canEdit && adding && (
        <div className={cn("mt-2 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 dark:border-emerald-500/30 dark:bg-emerald-500/5", compact ? "text-xs" : "text-sm")}>
          {/* Xona — ro'yxatdan yoki qo'lda */}
          <div>
            <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">{L("Xona", "Аудитория", "Room", "Raum")} *</label>
            {rooms.length > 0 && (
              <select value={rooms.includes(room) ? room : ""} onChange={(e) => setRoom(e.target.value)} className={cn(inp, "mb-1")}>
                <option value="">{L("— xonani tanlang —", "— выберите аудиторию —", "— select a room —", "— Raum wählen —")}</option>
                {rooms.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            )}
            <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder={L("masalan: 3-xona", "например: ауд. 3", "e.g. Room 3", "z. B. Raum 3")} className={inp} />
          </div>
          {/* Kunlar */}
          <div>
            <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">{L("Kunlar", "Дни", "Days", "Tage")} *</label>
            <div className="flex flex-wrap gap-1">
              {DAYS.map((d) => (
                <button key={d.key} type="button" onClick={() => toggleDay(d.key)} className={cn("rounded-md border px-2 py-1 text-[11px] font-semibold transition", days.includes(d.key) ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300")}>
                  {tr(locale, d.label)}
                </button>
              ))}
            </div>
          </div>
          {/* Vaqt */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">{L("Boshlanish", "Начало", "Start", "Beginn")} *</label>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={inp} />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">{L("Tugash", "Конец", "End", "Ende")} *</label>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={inp} />
            </div>
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">{L("Izoh", "Заметка", "Note", "Notiz")}</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={L("A1 yangi guruh, 5 ta joy", "A1 новая группа, 5 мест", "A1 new group, 5 seats", "A1 neue Gruppe, 5 Plätze")} className={inp} />
          </div>
          {err && <p className="text-[11px] text-rose-600">{err}</p>}
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => { setAdding(false); setErr(null); }} className={cn("rounded-lg px-2.5 font-medium text-slate-500 hover:bg-white/60 dark:hover:bg-white/5", compact ? "h-7 text-[11px]" : "h-8 text-xs")}>{L("Bekor", "Отмена", "Cancel", "Abbrechen")}</button>
            <button type="button" onClick={add} disabled={pending} className={cn("rounded-lg bg-emerald-600 px-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50", compact ? "h-7 text-[11px]" : "h-8 text-xs")}>{pending ? "..." : L("Saqlash", "Сохранить", "Save", "Speichern")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
