"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { addBranchSlot, listBranchRooms, removeBranchSlot, type VSlot } from "./actions";
import CapacityStepper from "../../_components/CapacityStepper";

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

export default function BranchSlotsEditor({ branchId, initial, canEdit, locale, compact = false, cards = false, color = "#10b981", onChanged, slotContent, slotCount, onDropLead }: {
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
  /** Karta ichida ko'rsatiladigan mazmun (masalan shu xonaga tashlangan lidlar) */
  slotContent?: (slotId: string) => React.ReactNode;
  /** Kartadagi lidlar soni (belgida) */
  slotCount?: (slotId: string) => number;
  /** Karta drop-zona: lid tashlanganda (leadId dataTransfer'dan) */
  onDropLead?: (slotId: string, leadId: string) => void;
}) {
  const [slots, setSlots] = useState<VSlot[]>(initial);
  const [adding, setAdding] = useState(false);
  const [rooms, setRooms] = useState<{ name: string; capacity: number }[]>([]);
  const [room, setRoom] = useState("");
  const [capacity, setCapacity] = useState(""); // sig'im — xona tanlansa Xonalar bo'limidan to'ladi (o'zgartirsa bo'ladi)
  const [capTouched, setCapTouched] = useState(false);
  const [openSlot, setOpenSlot] = useState<string | null>(null); // ichidagi lidlar ochilgan karta
  const [days, setDays] = useState<string[]>([]);
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("19:30");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [overSlot, setOverSlot] = useState<string | null>(null); // sudralayotgan lid ustida turgan karta
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
    const r = await addBranchSlot({ branchId, room, days: days.join(", "), startTime: start, endTime: end, note, capacity: capacity ? Number(capacity) : null });
    apply(r);
    if (r.ok) { setAdding(false); setRoom(""); setDays([]); setNote(""); setCapacity(""); }
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
        // Alohida kartalar — yashil ("bo'sh, ochiq") uslub, lid kartalaridan ajralib turadi;
        // har qatorga o'z belgisi: xona, kunlar, vaqt, daraja
        <ul className="space-y-3">
          {slots.map((sl) => {
            const count = slotCount?.(sl.id) ?? 0;
            const full = !!sl.capacity && count >= sl.capacity;
            const opened = openSlot === sl.id;
            return (
            <Fragment key={sl.id}>
            <li
              // Drop-zona: lid shu xonaga tashlanadi (to'lgan bo'lsa — yo'q)
              onDragOver={onDropLead ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = full ? "none" : "move"; if (overSlot !== sl.id) setOverSlot(sl.id); } : undefined}
              onDragLeave={onDropLead ? () => setOverSlot((c) => (c === sl.id ? null : c)) : undefined}
              onDrop={onDropLead ? (e) => { e.preventDefault(); e.stopPropagation(); const id = e.dataTransfer.getData("text/plain"); setOverSlot(null); if (id && !full) onDropLead(sl.id, id); } : undefined}
              onClick={count > 0 ? () => setOpenSlot(opened ? null : sl.id) : undefined}
              className={cn(
                "group relative overflow-hidden rounded-xl border p-3 shadow-[0_6px_18px_-12px_rgba(16,185,129,0.6)] transition",
                full
                  ? "bg-gradient-to-br from-rose-50 via-white to-white dark:from-rose-500/10 dark:via-[#15243d] dark:to-[#15243d]"
                  : "bg-gradient-to-br from-emerald-50 via-white to-white dark:from-emerald-500/10 dark:via-[#15243d] dark:to-[#15243d]",
                overSlot === sl.id
                  ? (full ? "border-rose-400 ring-2 ring-rose-300/60" : "border-emerald-500 ring-2 ring-emerald-400/60 scale-[1.01]")
                  : (full ? "border-rose-200/80 dark:border-rose-500/25" : "border-emerald-200/80 dark:border-emerald-500/25"),
                count > 0 && "cursor-pointer",
              )}
            >
              {/* chap chiziq: yashil — joy bor, qizil — to'lgan */}
              <span className={cn("absolute inset-y-0 left-0 w-1 bg-gradient-to-b", full ? "from-rose-400 to-rose-600" : "from-emerald-400 to-emerald-600")} />
              <div className="flex items-start gap-3 pl-1.5">
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white", full ? "bg-rose-500 shadow-[0_6px_14px_-6px_rgba(244,63,94,0.8)]" : "bg-emerald-500 shadow-[0_6px_14px_-6px_rgba(16,185,129,0.8)]")}>
                  <Icon name="building" className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-bold text-slate-800 dark:text-slate-100">{sl.room}</span>
                    {/* Sig'im: "1 / 8" (to'lgan — qizil), bo'sh — "BO'SH · 8 joy" */}
                    {count > 0 || sl.capacity ? (
                      <span className={cn("ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums", full ? "bg-rose-600 text-white" : count > 0 ? "bg-emerald-600 text-white" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300")}>
                        <Icon name="user" className="h-3 w-3" /> {count}{sl.capacity ? ` / ${sl.capacity}` : ""}{full ? ` · ${L("To'ldi", "Полно", "Full", "Voll")}` : ""}
                      </span>
                    ) : (
                      <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> {L("Bo'sh", "Свободно", "Free", "Frei")}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 space-y-1 text-[12px] text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-1.5"><Icon name="calendar" className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> <span className="truncate">{sl.days}</span></div>
                    <div className="flex items-center gap-1.5"><Icon name="clock" className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> <span className="tabular-nums font-semibold">{sl.startTime}–{sl.endTime}</span></div>
                  </div>
                  {sl.note && (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                      <Icon name="graduation" className="h-3.5 w-3.5" /> {sl.note}
                    </div>
                  )}
                  {/* Shu xonaga tashlangan lidlar — karta bosilganda ochiladi */}
                  {count > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <Icon name="chevronDown" className={cn("h-3.5 w-3.5 transition", opened && "rotate-180")} />
                      {opened ? L("Yopish", "Свернуть", "Collapse", "Zuklappen") : L(`${count} ta lidni ko'rish`, `Показать ${count} лидов`, `Show ${count} leads`, `${count} Leads anzeigen`)}
                    </div>
                  )}
                  {onDropLead && overSlot === sl.id && (
                    <div className={cn("mt-2 rounded-lg border border-dashed py-1.5 text-center text-[11px] font-semibold", full ? "border-rose-400 bg-rose-50/80 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" : "border-emerald-400 bg-emerald-50/80 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300")}>
                      {full ? L("Xona to'lgan — joy yo'q", "Аудитория заполнена", "Room is full", "Raum ist voll") : L("Shu xonaga qo'yish", "Поместить в эту аудиторию", "Place in this room", "In diesen Raum legen")}
                    </div>
                  )}
                </div>
                {canEdit && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); remove(sl.id); }} disabled={pending} title={L("O'chirish", "Удалить", "Remove", "Entfernen")} className="shrink-0 rounded-md p-1 text-slate-300 opacity-70 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100">
                    <Icon name="close" className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
            {/* Ochilgan xonaning lidlari — karta ostida, oddiy lid kartalari ko'rinishida */}
            {opened && slotContent && (
              <li className="relative ml-3 border-l-2 border-dashed border-emerald-300 pl-3 dark:border-emerald-500/40">
                {slotContent(sl.id)}
              </li>
            )}
            </Fragment>
            );
          })}
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
              <select
                value={rooms.some((r) => r.name === room) ? room : ""}
                onChange={(e) => { setRoom(e.target.value); const r = rooms.find((x) => x.name === e.target.value); if (r && r.capacity > 0 && !capTouched) setCapacity(String(r.capacity)); }}
                className={cn(inp, "mb-1")}
              >
                <option value="">{L("— xonani tanlang —", "— выберите аудиторию —", "— select a room —", "— Raum wählen —")}</option>
                {rooms.map((r) => <option key={r.name} value={r.name}>{r.name}{r.capacity > 0 ? ` (${r.capacity} ${L("joy", "мест", "seats", "Plätze")})` : ""}</option>)}
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
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={L("A1 yangi guruh", "A1 новая группа", "A1 new group", "A1 neue Gruppe")} className={inp} />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">
              {L("Sig'im", "Мест", "Seats", "Plätze")} <span className="font-normal text-slate-400">— {L("guruh yig'ish uchun, xonadan ko'p bo'lishi mumkin", "для набора, может быть больше кабинета", "for recruiting, may exceed the room", "zum Sammeln, darf den Raum übersteigen")}</span>
            </label>
            <CapacityStepper
              value={capacity ? Number(capacity) : 0}
              min={0}
              onChange={(n) => { setCapacity(n > 0 ? String(n) : ""); setCapTouched(true); }}
              roomCapacity={rooms.find((x) => x.name === room)?.capacity ?? null}
              locale={locale}
            />
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
