"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "./Icon";
import { setPaymentGrace } from "../students/actions";

const p2 = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const graceLabel = (iso: string) => {
  const d = new Date(iso);
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
};

export default function PaymentGraceButton({
  studentId, until, locale, compact = false, onDone,
}: {
  studentId: string;
  until: string | null;
  locale: Locale;
  compact?: boolean;
  onDone?: () => void;
}) {
  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const router = useRouter();
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [date, setDate] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const today = new Date();
  const min = isoDay(today);
  const max = isoDay(new Date(today.getTime() + 60 * 86_400_000));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const show = () => {
    const r = btn.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 288)) });
    setDate(until ? isoDay(new Date(until)) : isoDay(new Date(today.getTime() + 5 * 86_400_000)));
    setErr(null);
    setOpen(true);
  };

  const save = (value: string | null) => {
    setErr(null);
    start(async () => {
      const r = await setPaymentGrace(studentId, value);
      if (r.error) { setErr(r.error); return; }
      setOpen(false);
      onDone?.();
      router.refresh();
    });
  };

  const active = !!until;
  const title = active
    ? L(`${graceLabel(until!)} gacha muddat berilgan`, `Отсрочка до ${graceLabel(until!)}`, `Grace until ${graceLabel(until!)}`, `Frist bis ${graceLabel(until!)}`)
    : L("To'lov uchun muddat berish", "Дать отсрочку по оплате", "Give payment grace", "Zahlungsfrist gewähren");

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={(e) => { e.stopPropagation(); if (open) setOpen(false); else show(); }}
        title={title}
        aria-label={title}
        className={cn(
          compact
            ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition"
            : "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
          active
            ? "bg-sky-500/15 text-sky-600 hover:bg-sky-500/25 dark:text-sky-300"
            : compact
              ? "text-rose-500 hover:bg-rose-500/15"
              : "bg-white text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 dark:bg-white/5 dark:ring-rose-900/50",
        )}
      >
        <Icon name="clock" className="h-3.5 w-3.5" />
        {!compact && (active ? graceLabel(until!) : L("Muddat berish", "Отсрочка", "Give grace", "Frist geben"))}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[90]" onMouseDown={() => setOpen(false)}>
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{ top: pos.top, left: pos.left }}
            className="absolute w-[280px] rounded-xl border border-slate-200 bg-white p-3.5 shadow-pop dark:border-white/10 dark:bg-[#15243d]"
          >
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{L("Qaysi sanagacha faol bo'lsin?", "До какой даты активен?", "Active until which date?", "Aktiv bis zu welchem Datum?")}</div>
            <p className="mt-1 text-[11.5px] leading-snug text-slate-500 dark:text-slate-400">
              {L(
                "Shu sanagacha to'lov bloki olinadi — ustoz davomat belgilay oladi. Muzlatilgan bo'lsa, faollashtiriladi.",
                "До этой даты блок по оплате снят — преподаватель может отмечать посещаемость. Замороженный ученик станет активным.",
                "Until this date the payment block is lifted — the teacher can mark attendance. A frozen student becomes active.",
                "Bis zu diesem Datum ist die Zahlungssperre aufgehoben — die Lehrkraft kann Anwesenheit eintragen. Eingefrorene werden aktiv.",
              )}
            </p>
            <input
              type="date"
              value={date}
              min={min}
              max={max}
              onChange={(e) => setDate(e.target.value)}
              className="mt-2.5 h-9 w-full rounded-lg border border-slate-300 px-2.5 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            {err && <p className="mt-1.5 text-xs font-medium text-rose-500">{err}</p>}
            <div className="mt-3 flex gap-2">
              {active && (
                <button type="button" disabled={pending} onClick={() => save(null)} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300">
                  {L("Muddatni olib tashlash", "Снять отсрочку", "Remove grace", "Frist entfernen")}
                </button>
              )}
              <button type="button" disabled={pending || !date} onClick={() => save(date)} className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                {pending ? "…" : L("Saqlash", "Сохранить", "Save", "Speichern")}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
