"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import { exportRows } from "@/lib/export";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../../_components/Icon";
import type { DCall } from "./OperatorDetail";

// Operatorning qo'ng'iroqlar tarixi — Call jadvalidan (yozuv bo'lsa audio pleyer bilan).

const PAGE_SIZE = 20;

const fmtDur = (sec: number) => {
  const p2 = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}:${p2(m)}:${p2(sec % 60)}` : `${m}:${p2(sec % 60)}`;
};

const STATUS: Record<string, { label: { uz: string; ru: string; en: string; de: string }; icon: string; cls: string }> = {
  ANSWERED: { label: { uz: "Javob berildi", ru: "Отвечен", en: "Answered", de: "Angenommen" }, icon: "phoneCall", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  MISSED: { label: { uz: "O'tkazib yuborildi", ru: "Пропущен", en: "Missed", de: "Verpasst" }, icon: "phoneMissed", cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
  NO_ANSWER: { label: { uz: "Javob bermadi", ru: "Не ответил", en: "No answer", de: "Keine Antwort" }, icon: "phoneOff", cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
  BUSY: { label: { uz: "Band", ru: "Занято", en: "Busy", de: "Besetzt" }, icon: "phoneOff", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  FAILED: { label: { uz: "Xatolik", ru: "Ошибка", en: "Failed", de: "Fehler" }, icon: "alert", cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
  CANCELLED: { label: { uz: "Bekor qilindi", ru: "Отменён", en: "Cancelled", de: "Abgebrochen" }, icon: "close", cls: "bg-slate-500/15 text-slate-500 dark:text-slate-400" },
};

const DIR: Record<string, { label: { uz: string; ru: string; en: string; de: string }; icon: string; cls: string }> = {
  INCOMING: { label: { uz: "Kiruvchi", ru: "Входящий", en: "Incoming", de: "Eingehend" }, icon: "arrowDownLeft", cls: "text-indigo-600 dark:text-indigo-400" },
  OUTGOING: { label: { uz: "Chiquvchi", ru: "Исходящий", en: "Outgoing", de: "Ausgehend" }, icon: "arrowUpRight", cls: "text-emerald-600 dark:text-emerald-400" },
};

export default function CallsTable({ locale, calls }: { locale: Locale; calls: DCall[] }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return calls;
    return calls.filter((c) => `${c.contact ?? ""} ${c.phone} ${c.comment ?? ""}`.toLowerCase().includes(s));
  }, [calls, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const rows = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  const download = () => {
    exportRows(
      "operator-qongiroqlar",
      [
        { key: "when", label: tr(locale, { uz: "Vaqt", ru: "Время", en: "Time", de: "Zeit" }) },
        { key: "dir", label: tr(locale, { uz: "Tur", ru: "Тип", en: "Type", de: "Typ" }) },
        { key: "status", label: tr(locale, { uz: "Holat", ru: "Статус", en: "Status", de: "Status" }) },
        { key: "phone", label: tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone", de: "Telefon" }) },
        { key: "contact", label: tr(locale, { uz: "Abonent", ru: "Абонент", en: "Contact", de: "Kontakt" }) },
        { key: "duration", label: tr(locale, { uz: "Davomiylik", ru: "Длительность", en: "Duration", de: "Dauer" }) },
        { key: "comment", label: tr(locale, { uz: "Izoh", ru: "Комментарий", en: "Comment", de: "Kommentar" }) },
      ],
      filtered.map((c) => ({
        when: `${c.date} ${c.time}`,
        dir: DIR[c.direction] ? tr(locale, DIR[c.direction].label) : c.direction,
        status: STATUS[c.status] ? tr(locale, STATUS[c.status].label) : c.status,
        phone: c.phone,
        contact: c.contact ?? "",
        duration: fmtDur(c.duration),
        comment: c.comment ?? "",
      })),
    );
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder={tr(locale, { uz: "Ism, telefon...", ru: "Имя, телефон...", en: "Name, phone...", de: "Name, Telefon..." })}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <button
          type="button"
          onClick={download}
          className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Icon name="download" className="h-4 w-4" /> CSV
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="py-14 text-center">
          <Icon name="phone" className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="mt-2 text-sm text-slate-400">{tr(locale, { uz: "Qo'ng'iroq topilmadi", ru: "Звонки не найдены", en: "No calls found", de: "Keine Anrufe gefunden" })}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">{tr(locale, { uz: "Vaqt", ru: "Время", en: "Time", de: "Zeit" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Tur", ru: "Тип", en: "Type", de: "Typ" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Holat", ru: "Статус", en: "Status", de: "Status" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Telefon / Lid", ru: "Телефон / Лид", en: "Phone / Lead", de: "Telefon / Lead" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Davomiylik", ru: "Длительность", en: "Duration", de: "Dauer" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Yozuv", ru: "Запись", en: "Recording", de: "Aufnahme" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((c) => {
                const st = STATUS[c.status];
                const dir = DIR[c.direction];
                return (
                  <tr key={c.id} className="transition hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-slate-800 dark:text-slate-100">{c.date}</div>
                      <div className="text-xs text-slate-400">{c.time}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 text-xs font-medium", dir?.cls ?? "text-slate-500")}>
                        <Icon name={dir?.icon ?? "phone"} className="h-3 w-3" /> {dir ? tr(locale, dir.label) : c.direction}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", st?.cls ?? "bg-slate-500/15 text-slate-500")}>
                        <Icon name={st?.icon ?? "phone"} className="h-3 w-3" /> {st ? tr(locale, st.label) : c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 dark:text-slate-100">{c.phone}</div>
                      {c.contact && (
                        c.leadId
                          ? <Link href={`/crm/${c.leadId}`} className="block max-w-[160px] truncate text-xs text-brand-600 hover:underline dark:text-brand-300">{c.contact}</Link>
                          : <div className="max-w-[160px] truncate text-xs text-slate-400">{c.contact}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 tabular-nums text-slate-600 dark:text-slate-300">
                        <Icon name="clock" className="h-3 w-3 text-slate-400" /> {fmtDur(c.duration)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.recordingUrl
                        ? <audio controls preload="none" src={c.recordingUrl} className="h-8 w-[220px] max-w-full" />
                        : <span className="text-xs text-slate-300 dark:text-slate-600">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">
            {filtered.length} {tr(locale, { uz: "ta qo'ng'iroq", ru: "звонков", en: "calls", de: "Anrufe" })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={cur <= 1}
              onClick={() => setPage(cur - 1)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <Icon name="chevronDown" className="h-4 w-4 rotate-90" />
            </button>
            <span className="text-sm text-slate-600 dark:text-slate-300">{cur} / {pages}</span>
            <button
              type="button"
              disabled={cur >= pages}
              onClick={() => setPage(cur + 1)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <Icon name="chevronDown" className="h-4 w-4 -rotate-90" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
