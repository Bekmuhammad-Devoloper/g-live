"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import MoneyInput from "../../_components/MoneyInput";
import DateInput from "../../_components/DateInput";
import { slotGroupOptions, openGroupFromSlot, type SlotGroupOptions } from "./openGroup";
import type { VSlot } from "./actions";

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function OpenGroupFromSlot({ slot, count, locale, onDone }: {
  slot: VSlot;
  count: number;
  locale: Locale;
  onDone: (slots: VSlot[]) => void;
}) {
  const router = useRouter();
  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<SlotGroupOptions | null>(null);
  const [name, setName] = useState("");
  const [programId, setProgramId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [fee, setFee] = useState("");
  const [removeSlot, setRemoveSlot] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    setName(`${slot.note?.trim() || slot.room} ${slot.startTime}`);
    setErr(null);
    slotGroupOptions(slot.id).then((o) => setOpts(o ?? { programs: [], teachers: [] }));
  }, [open, slot]);

  const program = opts?.programs.find((p) => p.id === programId) ?? null;

  const submit = () => start(async () => {
    setErr(null);
    const r = await openGroupFromSlot(slot.id, {
      name, programId, teacherId: teacherId || null, startDate, monthlyFee: fee ? Number(fee) : null, removeSlot,
    });
    if (!r.ok) {
      setErr(
        r.error === "program" ? L("Kursni tanlang", "Выберите курс", "Select a course", "Kurs wählen")
        : r.error === "name" ? L("Guruh nomini kiriting", "Укажите название группы", "Enter a group name", "Gruppennamen eingeben")
        : r.error === "room_conflict" ? L(`Xona band: ${r.detail ?? ""}`, `Аудитория занята: ${r.detail ?? ""}`, `Room is busy: ${r.detail ?? ""}`, `Raum belegt: ${r.detail ?? ""}`)
        : r.error === "forbidden" ? L("Ruxsat yo'q", "Нет доступа", "No permission", "Keine Berechtigung")
        : r.error === "empty" ? L("Xonada lid yo'q", "В аудитории нет лидов", "No leads in this room", "Keine Leads im Raum")
        : L("Guruh ochilmadi", "Группа не создана", "Group was not created", "Gruppe nicht erstellt"),
      );
      return;
    }
    if (r.slots) onDone(r.slots);
    setOpen(false);
    router.refresh();
  });

  const inp = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";
  const lbl = "mb-1 block text-xs font-semibold text-slate-500";

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-emerald-700"
      >
        <Icon name="layers" className="h-3.5 w-3.5" />
        {L(`Guruh ochish (${count})`, `Открыть группу (${count})`, `Open group (${count})`, `Gruppe eröffnen (${count})`)}
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[120] flex justify-end bg-slate-900/40" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="animate-slide-in-right flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-[#15243d]">
            <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4 dark:border-white/10">
              <div>
                <div className="text-base font-bold text-slate-800 dark:text-slate-100">{L("Guruh ochish", "Открыть группу", "Open a group", "Gruppe eröffnen")}</div>
                <div className="text-xs text-slate-500">{slot.room} · {slot.days} · {slot.startTime}–{slot.endTime}</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <div className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
                {L(
                  `Xonadagi ${count} ta lid yangi guruhga qabul qilinadi. Guruh sig'imi to'lishini kutish shart emas.`,
                  `${count} лидов из аудитории будут зачислены в новую группу. Ждать заполнения не нужно.`,
                  `${count} leads in this room will be enrolled into the new group. It does not need to be full.`,
                  `${count} Leads aus diesem Raum werden in die neue Gruppe aufgenommen. Sie muss nicht voll sein.`,
                )}
              </div>
              <div>
                <label className={lbl}>{L("Guruh nomi", "Название группы", "Group name", "Gruppenname")} *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>{L("Kurs", "Курс", "Course", "Kurs")} *</label>
                <select value={programId} onChange={(e) => setProgramId(e.target.value)} className={inp}>
                  <option value="">{opts ? L("— kursni tanlang —", "— выберите курс —", "— select a course —", "— Kurs wählen —") : "…"}</option>
                  {opts?.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>{L("O'qituvchi", "Преподаватель", "Teacher", "Lehrer")}</label>
                <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={inp}>
                  <option value="">{L("— keyin tanlanadi —", "— выбрать позже —", "— choose later —", "— später wählen —")}</option>
                  {opts?.teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>{L("Boshlanish sanasi", "Дата начала", "Start date", "Startdatum")}</label>
                  <DateInput value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>{L("Oylik to'lov", "Оплата в месяц", "Monthly fee", "Monatsgebühr")}</label>
                  <MoneyInput value={fee} onChange={setFee} placeholder={program?.monthlyFee ? String(program.monthlyFee) : "0"} className={inp} />
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={removeSlot} onChange={(e) => setRemoveSlot(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
                {L("Bo'sh vaqt kartasini olib tashlash", "Убрать карточку свободного времени", "Remove the free-slot card", "Freie-Zeit-Karte entfernen")}
              </label>
              {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">{err}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200/70 px-5 py-4 dark:border-white/10">
              <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-lg px-4 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5">{L("Bekor", "Отмена", "Cancel", "Abbrechen")}</button>
              <button type="button" onClick={submit} disabled={pending || !programId || name.trim().length < 2} className={cn("h-10 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50")}>
                {pending ? "..." : L("Guruhni ochish", "Открыть группу", "Open group", "Gruppe eröffnen")}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
